'use strict';
// Explicit ICAO -> IATA aliases. Never truncate an unknown three-character code.
const airlineDirectory=[
 ['CCA','CA','中国国际航空'],['CES','MU','中国东方航空'],['CSN','CZ','中国南方航空'],['DKH','HO','吉祥航空'],['CSH','FM','上海航空'],['CSZ','ZH','深圳航空'],['CQH','9C','春秋航空'],['CHH','HU','海南航空'],['CXA','MF','厦门航空'],['CSC','3U','四川航空'],['CDG','SC','山东航空'],['CBJ','JD','首都航空'],['GCR','GS','天津航空'],['CBG','GX','北部湾航空'],['CUA','KN','中国联合航空'],['UEA','EU','成都航空'],['CDC','GJ','长龙航空'],['CGH','GY','多彩贵州航空'],['QDA','QW','青岛航空'],['CCA','CA','国航'],
 ['DLH','LH','汉莎航空'],['DAL','DL','达美航空'],['AFR','AF','法国航空'],['THY','TK','土耳其航空'],['SAS','SK','北欧航空'],['AAL','AA','美国航空'],['JTA','NU','日本越洋航空'],['MSC','SM','开罗航空'],['SVA','SV','沙特航空'],['CPA','CX','国泰航空'],['OAL','OA','奥林匹克航空'],['AAR','OZ','韩亚航空'],['ANA','NH','全日空'],['HKE','UO','香港快运'],['KAL','KE','大韩航空'],['AEE','A3','爱琴海航空'],['WIF','WF','维德罗航空'],
 ['UAL','UA','美国联合航空'],['JAL','JL','日本航空'],['KLM','KL','荷兰皇家航空'],['BAW','BA','英国航空'],['FIN','AY','芬兰航空'],['SWR','LX','瑞士国际航空'],['AUA','OS','奥地利航空'],['IBE','IB','西班牙国家航空'],['TAP','TP','葡萄牙航空'],['LOT','LO','波兰航空'],['EIN','EI','爱尔兰航空'],['QFA','QF','澳洲航空'],['ANZ','NZ','新西兰航空'],['SIA','SQ','新加坡航空'],['THA','TG','泰国国际航空'],['MAS','MH','马来西亚航空'],['AXM','AK','亚洲航空'],['EVA','BR','长荣航空'],['CAL','CI','中华航空'],['HDA','KA','港龙航空'],['CRK','HX','香港航空'],['MDA','AE','华信航空'],['JSA','3K','捷星亚洲航空'],['JJP','GK','捷星日本航空'],['APJ','MM','乐桃航空'],['JJA','7C','济州航空'],['JNA','LJ','真航空'],['ESR','ZE','易斯达航空'],['TWB','TW','德威航空'],['CEB','5J','宿务太平洋航空'],['PAL','PR','菲律宾航空'],['VNA','VN','越南航空'],['VJC','VJ','越捷航空'],['GIA','GA','印尼鹰航'],['ETD','EY','阿提哈德航空'],['UAE','EK','阿联酋航空'],['QTR','QR','卡塔尔航空'],['OMA','WY','阿曼航空'],['GFA','GF','海湾航空'],['FDB','FZ','迪拜航空'],['MSR','MS','埃及航空'],['ETH','ET','埃塞俄比亚航空'],['KQA','KQ','肯尼亚航空'],['RAM','AT','摩洛哥皇家航空'],['ACA','AC','加拿大航空'],['WJA','WS','西捷航空'],['ASA','AS','阿拉斯加航空'],['JBU','B6','捷蓝航空'],['SWA','WN','西南航空'],['LAN','LA','南美航空'],['TAM','JJ','巴西天马航空']
];
const airlineAliases=new Map();
for(const [icao,iata,name] of airlineDirectory){airlineAliases.set(icao,iata);airlineAliases.set(iata,iata);airlineAliases.set(name,iata);}
function normalizeAirlineCode(value){const code=String(value??'').trim().toUpperCase();return airlineAliases.get(code)||code;}
function validAirlineCode(value){return !value||/^[A-Z0-9]{2}$/.test(value);}

