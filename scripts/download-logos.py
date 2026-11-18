import concurrent.futures, hashlib, json, urllib.request, urllib.parse, xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
assets=json.loads((ROOT/'.research/assets.json').read_text(encoding='utf-8'))
apps=json.loads((ROOT/'.research/apps.json').read_text(encoding='utf-8'))
selection={}
for slug,term in {'lime':'Lime ride','voi':'Voi scooters','uber':'Uber ride','uber-eats':'Uber Eats','gopuff':'Gopuff','lebara':'MyLebara','binance':'Binance'}.items():
    row=apps[term][0]
    selection[slug]={'url':row['artworkUrl100'],'source':row['trackViewUrl'],'label':row['trackName'],'ext':'jpg'}
for slug in ['forest','octopus-energy','wise','yonder','plum']:
    candidates=assets[slug]['icons']
    icon=next((a for a in candidates if a['rel']=='apple-touch-icon'),None) or next((a for a in candidates if 'light' in a['url']),None) or candidates[0]
    selection[slug]={'url':icon['url'],'source':assets[slug]['home'],'label':slug,'ext':'png'}
for slug in ['monzo','jp-morgan-personal-investing','etoro']:
    icon=next(a for a in assets[slug]['icons'] if urllib.parse.urlsplit(a['url']).path.endswith('.svg') and a['rel']=='icon')
    selection[slug]={'url':icon['url'],'source':assets[slug]['home'],'label':slug,'ext':'svg'}
selection['eatclub']={'url':assets['eatclub']['logos'][0]['url'],'source':assets['eatclub']['home'],'label':'EatClub','ext':'svg'}

def download(item):
    slug,entry=item
    req=urllib.request.Request(entry['url'],headers={'User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(req,timeout=20) as r: data=r.read(600000)
    if entry['ext']=='svg':
        tree=ET.fromstring(data)
        for el in tree.iter():
            if el.tag.split('}')[-1] in ['script','foreignObject','iframe']: raise ValueError('Unsafe SVG')
            if any(k.lower().startswith('on') for k in el.attrib):raise ValueError('Unsafe SVG handler')
    elif not (data.startswith(b'\x89PNG') or data.startswith(b'\xff\xd8')):raise ValueError('Unexpected raster file')
    name=f"{slug}.{entry['ext']}"; (ROOT/'public/brands'/name).write_bytes(data)
    return slug,{'file':f'/brands/{name}','sourceUrl':entry['source'],'assetUrl':entry['url'],'retrievedAt':'2026-11-18','sha256':hashlib.sha256(data).hexdigest()}

if __name__=='__main__':
    (ROOT/'public/brands').mkdir(exist_ok=True)
    result=dict(concurrent.futures.ThreadPoolExecutor(max_workers=8).map(download,selection.items()))
    (ROOT/'content/brands.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({key:value['file'] for key,value in result.items()},indent=2))
