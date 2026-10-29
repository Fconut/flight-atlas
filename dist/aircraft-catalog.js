'use strict';
// Curated passenger-aircraft checklist, not a live global operational-status feed.
const aircraftCatalogChecked='2026-10-29';
const aircraftCatalogSources={airbus:'https://www.airbus.com/en/products-services/commercial-aircraft/passenger-aircraft',qatar:'https://www.qatarairways.com/en-sg/fleet.html',lufthansa:'https://www.lufthansa.com/xx/en/seat-maps',united:'https://www.united.com/en/us/fly/company/aircraft.html',atr:'https://www.atr-aircraft.com/regional-mobility/regional-aircraft/',embraer:'https://www.embraer.com/',dhc:'https://dehavilland.com/dash-8-400/',comac:'https://english.comac.cc/products/c909/'};
const aircraftCatalog=[
 ['Airbus A220-100','airbus',['A221','BCS1','CS100']],['Airbus A220-300','airbus',['A223','BCS3','CS300']],
 ['Airbus A319','lufthansa',['A319','A319-100']],['Airbus A320','qatar',['A320','A320-200']],['Airbus A320neo','airbus',['A20N','A320 neo']],['Airbus A321','lufthansa',['A321','A321-200']],['Airbus A321neo','airbus',['A21N','A321 neo']],
 ['Airbus A330-200','qatar',['A332']],['Airbus A330-300','qatar',['A333']],['Airbus A330-900','airbus',['A339','A330-900neo']],['Airbus A350-900','qatar',['A359']],['Airbus A350-1000','qatar',['A35K']],['Airbus A380-800','qatar',['A388','Airbus A380','A380']],
 ['Boeing 737-700','united',['B737']],['Boeing 737-800','united',['B738']],['Boeing 737-900','united',['B739','737-900ER']],['Boeing 737 MAX 8','united',['B38M','737-8 MAX','737 MAX8']],['Boeing 737 MAX 9','united',['B39M','737-9 MAX','737 MAX9']],
 ['Boeing 747-400','lufthansa',['B744']],['Boeing 747-8','lufthansa',['B748','747-8i','747-8 Intercontinental']],['Boeing 777-200ER','united',['B772','777-200 ER']],['Boeing 777-200LR','qatar',['B77L','777-200 LR']],['Boeing 777-300ER','qatar',['B77W','777-300 ER']],['Boeing 787-8','qatar',['B788']],['Boeing 787-9','qatar',['B789']],['Boeing 787-10','united',['B78X']],
 ['ATR 42-600','atr',['AT46','ATR42-600']],['ATR 72-600','atr',['AT76','ATR72-600']],['Embraer E175','embraer',['E75L','E75S','Embraer 175']],['Embraer E190-E2','embraer',['E290']],['Embraer E195-E2','embraer',['E295']],['De Havilland Dash 8-400','dhc',['DH8D','DHC-8-400','Bombardier Q400','Dash 8 Q400']],['COMAC C909','comac',['ARJ21','ARJ21-700','COMAC ARJ21','COMAC ARJ21-700']],['COMAC C919','comac',['C919']]
].map(([name,source,aliases])=>({name,source:aircraftCatalogSources[source],aliases}));
function aircraftAlias(value){return String(value||'').toUpperCase().replace(/BOEING|AIRBUS|EMBRAER|COMAC|DE HAVILLAND|BOMBARDIER/g,'').replace(/[^A-Z0-9]/g,'');}
function catalogAircraft(value){const key=aircraftAlias(value);return aircraftCatalog.find(a=>[a.name,...a.aliases].some(alias=>aircraftAlias(alias)===key));}
