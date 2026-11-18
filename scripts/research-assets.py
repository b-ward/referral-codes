import concurrent.futures, json, re, urllib.request, urllib.parse
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITES = {
    'lime':'https://www.li.me/', 'forest':'https://www.forest.me/', 'voi':'https://www.voi.com/',
    'uber':'https://www.uber.com/gb/en/', 'uber-eats':'https://www.ubereats.com/gb/',
    'eatclub':'https://eatclub.com.au/', 'gopuff':'https://www.gopuff.com/gb/',
    'octopus-energy':'https://octopus.energy/', 'lebara':'https://www.lebara.co.uk/',
    'binance':'https://www.binance.com/', 'wise':'https://wise.com/', 'monzo':'https://monzo.com/',
    'plum':'https://withplum.com/', 'yonder':'https://www.yonder.com/',
    'jp-morgan-personal-investing':'https://www.personalinvesting.jpmorgan.com/', 'etoro':'https://www.etoro.com/'
}

class Assets(HTMLParser):
    def __init__(self, base):
        super().__init__(); self.base=base; self.icons=[]; self.logos=[]; self.apps=[]
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if tag=='link' and 'icon' in a.get('rel','').lower() and a.get('href'):
            self.icons.append({'url':urllib.parse.urljoin(self.base,a['href']), 'rel':a.get('rel'), 'sizes':a.get('sizes')})
        if tag=='img' and ('logo' in a.get('alt','').lower() or 'logo' in a.get('src','').lower()):
            self.logos.append({'url':urllib.parse.urljoin(self.base,a.get('src','')), 'alt':a.get('alt','')})
        if tag=='a' and 'apps.apple.com' in a.get('href',''): self.apps.append(a['href'])

def inspect(item):
    key,url=item
    try:
        req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=20) as response:
            final=response.url; html=response.read(4000000).decode('utf-8','replace')
        parser=Assets(final); parser.feed(html)
        return key, {'home':final,'icons':parser.icons[:8], 'logos':parser.logos[:8], 'apps':list(set(parser.apps))[:3]}
    except Exception as error: return key, {'home':url,'error':str(error)}

if __name__=='__main__':
    result=dict(concurrent.futures.ThreadPoolExecutor(max_workers=8).map(inspect,SITES.items()))
    directory=ROOT/'.research'; directory.mkdir(exist_ok=True)
    (directory/'assets.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result,indent=2))
