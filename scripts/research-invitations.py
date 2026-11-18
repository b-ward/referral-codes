import concurrent.futures, json, re, urllib.request, urllib.parse
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent

def fetch(url):
    req=urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(req,timeout=20) as r: return r.url,r.read(3000000).decode('utf-8','replace')

def app(term):
    try:
        _,text=fetch('https://itunes.apple.com/search?'+urllib.parse.urlencode({'term':term,'entity':'software','country':'gb','limit':3}))
        rows=json.loads(text)['results']
        return term,[{k:r.get(k) for k in ['trackId','trackName','sellerName','trackViewUrl','artworkUrl512','artworkUrl100']} for r in rows]
    except Exception as e:return term,{'error':str(e)}

def invitation(o):
    try:
        url,text=fetch(o['referralUrl'])
        clean=re.sub(r'<(script|style)\b[^>]*>.*?</\1>','',text,flags=re.S|re.I)
        clean=re.sub(r'<[^>]+>',' ',clean);clean=re.sub(r'\s+',' ',clean)
        return o['slug'],{'url':url,'text':clean[:14000]}
    except Exception as e:return o['slug'],{'error':str(e)}

if __name__=='__main__':
    terms=['Lime ride','Voi scooters','Uber ride','Uber Eats','Gopuff','MyLebara','Binance']
    apps=dict(concurrent.futures.ThreadPoolExecutor(max_workers=7).map(app,terms))
    offers=json.loads((ROOT/'content/offers.json').read_text(encoding='utf-8'))
    chosen=[o for o in offers if o['slug'] in ['forest','voi','lime','wise','yonder','plum','jp-morgan-personal-investing','monzo']]
    invitations=dict(concurrent.futures.ThreadPoolExecutor(max_workers=8).map(invitation,chosen))
    (ROOT/'.research/apps.json').write_text(json.dumps(apps,indent=2),encoding='utf-8')
    (ROOT/'.research/invitations.json').write_text(json.dumps(invitations,indent=2),encoding='utf-8')
    print(json.dumps({'apps':apps,'invitations':invitations},indent=2))
