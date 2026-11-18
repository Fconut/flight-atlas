// Original vector artwork. All coordinates are local to a 200-unit stamp.
function draw(ctx,item,x,y,size,ink=item.ink){
 if(!item)return;
 ctx.save();ctx.translate(x,y);ctx.scale(size/200,size/200);
 ctx.strokeStyle=ink;ctx.fillStyle=ink;ctx.lineWidth=1.5;ctx.lineCap='round';ctx.lineJoin='round';
 const line=(p,close=false)=>{ctx.beginPath();p.forEach(([a,b],i)=>i?ctx.lineTo(a,b):ctx.moveTo(a,b));if(close)ctx.closePath();ctx.stroke()};
 const circle=(x,y,r)=>{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke()};
 const arc=(x,y,r,a,b)=>{ctx.beginPath();ctx.arc(x,y,r,a,b);ctx.stroke()};
 const curve=(p)=>{ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.bezierCurveTo(...p.slice(2));ctx.stroke()};
 const rect=(x,y,w,h)=>ctx.strokeRect(x,y,w,h);
 const star=(x,y,r=6)=>line(Array.from({length:8},(_,i)=>{const a=i*Math.PI/4-Math.PI/2,k=i%2?r*.28:r;return[x+Math.cos(a)*k,y+Math.sin(a)*k]}),true);
 function frame(inset){
  const f=item.frame,a=15+inset,b=185-inset;
  if(f===0){circle(100,100,85-inset);return}
  if(f===1){ctx.save();ctx.translate(100,100);ctx.scale(1,.77);circle(0,0,85-inset);ctx.restore();return}
  if(f===2){ctx.beginPath();ctx.moveTo(a+8,a+15);ctx.lineTo(b-8,a+15);ctx.quadraticCurveTo(b,a+15,b,a+23);ctx.lineTo(b,b-23);ctx.quadraticCurveTo(b,b-15,b-8,b-15);ctx.lineTo(a+8,b-15);ctx.quadraticCurveTo(a,b-15,a,b-23);ctx.lineTo(a,a+23);ctx.quadraticCurveTo(a,a+15,a+8,a+15);ctx.stroke();return}
  if(f===3){ctx.beginPath();ctx.moveTo(a,184-inset);ctx.lineTo(a,91);ctx.bezierCurveTo(a,12+inset,b,12+inset,b,91);ctx.lineTo(b,184-inset);ctx.closePath();ctx.stroke();return}
  // Postage teeth are an intentional frame, not a national/government seal.
  const step=(b-a)/12;ctx.beginPath();ctx.moveTo(a,a);
  for(let i=0;i<12;i++)ctx.quadraticCurveTo(a+(i+.5)*step,a+5,a+(i+1)*step,a);
  for(let i=0;i<12;i++)ctx.quadraticCurveTo(b-5,a+(i+.5)*step,b,a+(i+1)*step);
  for(let i=0;i<12;i++)ctx.quadraticCurveTo(b-(i+.5)*step,b-5,b-(i+1)*step,b);
  for(let i=0;i<12;i++)ctx.quadraticCurveTo(a+5,b-(i+.5)*step,a,b-(i+1)*step);
  ctx.closePath();ctx.stroke();
 }
 frame(0);ctx.lineWidth=.6;frame(5);ctx.lineWidth=size<100?2.25:1.5;
 const wave=(y=120)=>{for(let i=0;i<3;i++)curve([48,y+i*8,70,y-18+i*8,115,y+18+i*8,152,y-3+i*8])};
 const cloud=(x=80,y=95,s=1)=>{ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.beginPath();ctx.moveTo(-27,9);ctx.bezierCurveTo(-42,9,-41,-10,-26,-11);ctx.bezierCurveTo(-23,-31,3,-30,9,-15);ctx.bezierCurveTo(28,-27,44,-10,33,6);ctx.bezierCurveTo(31,12,20,12,-27,9);ctx.stroke();ctx.restore()};
 const plane=()=>line([[51,92],[89,101],[122,71],[133,72],[113,104],[149,111],[153,118],[106,116],[85,135],[77,135],[87,113],[55,101]],true);
 const mountain=()=>{line([[45,126],[78,77],[99,100],[118,66],[157,126]]);line([[67,94],[78,102],[84,94]]);line([[107,83],[118,94],[125,82]]);line([[53,132],[149,132]]);for(let i=0;i<5;i++)line([[81+i*5,110+i],[72+i*5,124]])};
 const sun=()=>{circle(100,91,20);for(let i=0;i<12;i++){const a=i*Math.PI/6;line([[100+Math.cos(a)*26,91+Math.sin(a)*26],[100+Math.cos(a)*35,91+Math.sin(a)*35]])}};
 const moon=()=>{ctx.beginPath();ctx.moveTo(108,65);ctx.bezierCurveTo(67,54,57,119,104,126);ctx.bezierCurveTo(124,128,138,117,142,105);ctx.bezierCurveTo(114,117,91,94,108,65);ctx.stroke();star(135,74,7);star(148,95,4)};
 const pine=(x=100,y=78,s=1)=>{ctx.save();ctx.translate(x,y);ctx.scale(s,s);line([[0,-15],[-16,10],[-8,10],[-23,30],[-11,30],[-29,51],[29,51],[11,30],[23,30],[8,10],[16,10],[0,-15]]);line([[0,51],[0,64]]);ctx.restore()};
 const letter=()=>{rect(57,82,86,51);line([[57,82],[100,113],[143,82]]);line([[57,133],[85,108]]);line([[143,133],[115,108]]);circle(100,112,5)};
 const bird=()=>{curve([49,87,68,66,83,85,100,101]);curve([100,101,120,78,134,70,153,82]);line([[96,98],[100,107],[108,100]])};
 const roof=()=>{line([[50,104],[100,66],[150,104]]);rect(62,104,76,38);rect(91,116,17,26);rect(72,114,11,11);rect(118,114,11,11)};
 const camera=()=>{line([[51,90],[75,90],[83,77],[116,77],[124,90],[149,90],[149,135],[51,135]],true);circle(102,112,19);circle(102,112,13);rect(60,98,14,8)};
 const bag=()=>{rect(63,78,75,60);line([[84,78],[84,65],[117,65],[117,78]]);line([[78,78],[78,138]]);line([[124,78],[124,138]]);rect(91,99,18,14);circle(77,145,3);circle(127,145,3)};
 const lighthouse=()=>{line([[83,136],[90,82],[113,82],[121,136]],true);rect(87,70,29,12);line([[85,70],[101,55],[119,70]]);line([[72,77],[45,68]]);line([[130,77],[154,66]]);line([[91,109],[115,109]]);wave(138)};
 const flower=()=>{for(let i=0;i<10;i++){ctx.save();ctx.translate(100,100);ctx.rotate(i*Math.PI/5);ctx.beginPath();ctx.moveTo(0,-13);ctx.bezierCurveTo(-25,-51,25,-51,0,-13);ctx.stroke();ctx.restore()}circle(100,100,13);for(let i=0;i<7;i++)circle(95+i%3*5,96+Math.floor(i/3)*5,1)};
 const wheel=()=>{circle(100,103,39);circle(100,103,33);circle(100,103,7);for(let i=0;i<8;i++){const a=i*Math.PI/4;line([[100+Math.cos(a)*7,103+Math.sin(a)*7],[100+Math.cos(a)*46,103+Math.sin(a)*46]])}};
 const cup=()=>{line([[62,94],[69,128],[124,128],[133,94]],true);curve([133,99,165,89,158,125,128,119]);line([[55,136],[140,136]]);for(let i=0;i<3;i++)curve([79+i*16,84,69+i*16,74,94+i*16,68,84+i*16,59])};
 const leaves=()=>{curve([74,139,88,113,108,92,129,67]);for(let i=0;i<4;i++){const x=83+i*11,y=125-i*16;curve([x,y,x-34,y-27,x+2,y-37,x,y]);curve([x,y,x+32,y+5,x+36,y-26,x,y])}};
 const river=()=>{mountain();curve([100,115,59,126,153,132,110,145]);curve([111,115,70,127,166,131,127,145])};
 const window=()=>{rect(65,64,73,83);line([[101,64],[101,147]]);line([[65,103],[138,103]]);line([[60,151],[143,151]]);line([[74,119],[88,106],[98,117]]);arc(118,89,10,Math.PI,Math.PI*2)};
 const skyline=()=>{line([[45,137],[45,104],[63,104],[63,80],[81,80],[81,116],[94,116],[94,65],[110,65],[110,92],[126,92],[126,78],[141,78],[141,137],[155,137]]);for(let r=0;r<3;r++)for(let c=0;c<3;c++)rect(98+c*3,76+r*10,1,3)};
 switch(item.motif){
 case'plane':plane();cloud(68,130,.55);curve([59,77,76,55,105,48,143,51]);break;
 case'letter':letter();line([[47,73],[61,70]]);line([[143,70],[154,65]]);break;
 case'cloud':cloud(100,98,1.2);cloud(65,127,.55);star(140,67);break;
 case'balloon':ctx.beginPath();ctx.moveTo(100,119);ctx.bezierCurveTo(28,39,170,32,100,119);ctx.stroke();curve([100,59,71,72,88,100,100,119]);curve([100,59,128,72,114,100,100,119]);line([[92,117],[94,130],[106,130],[110,117]]);rect(92,130,17,10);break;
 case'wind':cloud(78,87,.65);for(let i=0;i<4;i++)curve([51,109+i*8,84,94+i*8,124,127+i*8,151,106+i*8]);break;
 case'paper':line([[49,83],[151,66],[106,140],[97,107],[49,83],[97,100],[151,66],[97,107],[83,128],[87,105]]);break;
 case'postcard':rect(49,73,103,65);line([[114,73],[114,138]]);rect(123,80,19,19);mountain();break;
 case'mailbox':line([[70,139],[70,88]]);arc(95,88,25,Math.PI,Math.PI*2);line([[120,88],[120,139],[70,139]]);rect(79,96,32,7);line([[91,139],[91,155],[105,155],[105,139]]);break;
 case'stars':cloud(86,121,.9);star(99,70,13);star(137,85,7);star(62,85,5);break;
 case'book':line([[100,82],[71,70],[52,75],[52,133],[75,128],[100,140],[126,129],[147,133],[147,75],[127,70],[100,82],[100,140]]);for(let i=0;i<4;i++){line([[61,88+i*9],[89,97+i*9]]);line([[111,96+i*9],[136,86+i*9]])}break;
 case'mountain':mountain();circle(63,68,9);break;
 case'wave':wave(85);wave(113);break;
 case'lake':mountain();for(let i=0;i<4;i++)line([[65+i*4,138+i*5],[143-i*7,138+i*5]]);break;
 case'waterfall':line([[53,77],[83,70],[118,76],[147,69]]);for(let i=0;i<7;i++)curve([83+i*6,76,75+i*7,97,94+i*5,112,77+i*7,134]);wave(137);break;
 case'river':case'nightpath':river();if(item.motif==='nightpath')star(139,68);break;
 case'compass':circle(100,103,37);line([[100,65],[113,103],[100,142],[87,103]],true);line([[62,103],[100,90],[139,103],[100,116]],true);circle(100,103,5);break;
 case'hiker':circle(108,81,7);line([[107,88],[101,113],[88,137]]);line([[101,113],[116,137]]);line([[105,96],[125,105],[130,142]]);rect(90,92,12,19);line([[65,139],[82,118],[98,139]]);break;
 case'lighthouse':lighthouse();break;
 case'bird':bird();wave(128);break;
 case'bridge':line([[43,91],[156,91]]);line([[43,99],[156,99]]);for(let i=0;i<4;i++){const x=50+i*28;line([[x,99],[x,140]]);arc(x+14,123,14,Math.PI,Math.PI*2)}wave(146);break;
 case'moon':moon();break;
 case'telescope':line([[58,84],[131,65],[137,87],[64,106]],true);line([[101,99],[101,141]]);line([[101,107],[77,144]]);line([[101,107],[127,144]]);star(143,58);break;
 case'aurora':for(let i=0;i<6;i++)curve([48+i*8,113,47+i*7,55,127+i*4,99,126+i*5,58]);pine(65,126,.35);pine(138,126,.4);break;
 case'dome':arc(100,110,39,Math.PI,Math.PI*2);rect(61,110,78,30);line([[100,71],[100,110]]);curve([88,73,69,89,80,104,80,110]);star(137,64);break;
 case'constellation':{const p=[[57,83],[87,72],[117,84],[146,70],[139,124],[109,113],[78,136],[57,83]];line(p);p.slice(0,-1).forEach(q=>star(...q,5));break}
 case'orbit':circle(100,102,22);ctx.save();ctx.translate(100,102);ctx.rotate(-.5);ctx.scale(1,.4);circle(0,0,54);ctx.restore();star(139,72);break;
 case'phases':for(let i=0;i<5;i++){circle(56+i*22,101,8);if(i!==2)line([[55+i*22,94],[55+i*22,108]])}mountain();break;
 case'lantern':rect(78,86,45,48);line([[75,86],[100,69],[126,86]]);arc(100,65,7,Math.PI,Math.PI*2);line([[87,89],[87,129]]);line([[113,89],[113,129]]);line([[74,138],[128,138]]);break;
 case'star':star(100,94,29);wave(135);break;
 case'ship':line([[48,116],[151,116],[137,135],[64,135]],true);line([[100,116],[100,61],[67,105],[97,105]]);line([[106,66],[139,105],[106,105]],true);wave(143);break;
 case'wheel':wheel();break;
 case'anchor':circle(100,73,10);line([[100,83],[100,135]]);line([[76,96],[124,96]]);curve([61,112,65,151,133,151,140,112]);line([[61,112],[58,126],[72,119]]);line([[140,112],[143,126],[130,119]]);break;
 case'case':case'bag':bag();if(item.motif==='bag')rect(79,91,13,20);break;
 case'bottle':line([[93,65],[107,65],[107,83],[125,105],[125,138],[75,138],[75,105],[93,83]],true);rect(89,59,22,7);line([[83,113],[118,113]]);star(101,123,6);break;
 case'whale':curve([45,105,77,79,116,98,124,113]);curve([45,105,54,148,118,145,124,113]);line([[124,113],[140,93],[153,91],[147,109],[124,113]]);circle(63,109,2);wave(147);break;
 case'sail':line([[98,59],[98,120],[62,120],[98,59],[137,118],[105,118]]);line([[54,129],[144,129],[127,142],[72,142]],true);break;
 case'sun':case'sunrise':case'sunset':case'hills':sun();if(item.motif==='sunrise'||item.motif==='sunset')wave(123);else line([[47,137],[81,116],[113,134],[151,114]]);break;
 case'flower':flower();break;
 case'butte':line([[43,137],[58,113],[71,113],[72,80],[95,80],[96,117],[112,117],[112,95],[132,95],[142,137]]);for(let i=0;i<4;i++)line([[77+i*4,87],[77+i*4,118]]);circle(138,73,11);break;
 case'camera':camera();break;
 case'leaves':leaves();break;
 case'chair':line([[61,112],[135,112],[116,137],[49,137],[61,112],[87,73],[145,73],[135,112]]);line([[65,137],[72,151]]);line([[110,137],[117,150]]);line([[80,91],[138,91]]);break;
 case'window':window();break;
 case'bear':line([[48,110],[61,86],[85,80],[104,89],[131,87],[147,100],[152,111],[137,119],[129,142],[118,142],[116,119],[81,119],[71,140],[61,140],[63,118]],true);circle(138,98,2);arc(129,86,5,Math.PI,Math.PI*2);break;
 case'snow':for(let i=0;i<6;i++){ctx.save();ctx.translate(100,104);ctx.rotate(i*Math.PI/3);line([[0,0],[0,-44]]);line([[-9,-32],[0,-23],[9,-32]]);line([[-12,-21],[0,-9],[12,-21]]);ctx.restore()}break;
 case'igloo':arc(100,126,47,Math.PI,Math.PI*2);line([[53,126],[147,126]]);arc(107,126,15,Math.PI,Math.PI*2);line([[61,102],[139,102]]);line([[73,86],[73,102]]);line([[96,79],[96,102]]);line([[125,86],[125,102]]);break;
 case'iceberg':line([[45,126],[77,89],[96,113],[113,70],[153,126]],true);line([[113,70],[110,115],[126,106]]);wave(140);break;
 case'pines':pine(76,85,.8);pine(130,89,.7);break;
 case'deer':line([[65,118],[80,104],[113,109],[126,91],[135,93],[133,118],[117,129],[113,145]]);line([[78,118],[76,143]]);line([[87,123],[97,142]]);line([[129,93],[126,70],[117,60]]);line([[126,77],[137,64]]);line([[126,83],[114,75]]);circle(132,99,1.5);break;
 case'crystal':line([[100,61],[125,87],[116,141],[82,141],[73,87]],true);line([[100,61],[91,90],[100,141],[109,90],[100,61]]);line([[73,87],[91,90],[109,90],[125,87]]);break;
 case'penguin':ctx.beginPath();ctx.moveTo(82,133);ctx.bezierCurveTo(62,57,130,55,126,132);ctx.closePath();ctx.stroke();curve([87,131,76,82,116,77,116,133]);line([[126,88],[141,95],[126,100]]);circle(117,86,2);line([[80,140],[92,135]]);line([[118,135],[131,140]]);break;
 case'cabin':case'hut':roof();pine(151,97,.5);break;
 case'cone':ctx.beginPath();ctx.moveTo(100,65);ctx.bezierCurveTo(48,93,66,146,100,143);ctx.bezierCurveTo(135,146,151,92,100,65);ctx.stroke();for(let i=0;i<5;i++){line([[77,91+i*9],[100,106+i*7],[122,91+i*9]])}break;
 case'rings':for(let i=0;i<7;i++){ctx.save();ctx.translate(100,105);ctx.scale(1,.68);circle(0,0,8+i*6);ctx.restore()}break;
 case'birch':for(let i=0;i<4;i++){const x=62+i*24;line([[x,64],[x-3,144]]);line([[x+9,64],[x+5,144]]);for(let k=0;k<4;k++)line([[x,76+k*17],[x+6,78+k*17]])}break;
 case'buildings':case'skyline':skyline();if(item.motif==='buildings')arc(100,64,15,Math.PI,Math.PI*2);break;
 case'lamp':case'clock':if(item.motif==='clock'){rect(81,88,39,55);circle(100,85,23);line([[100,85],[100,70]]);line([[100,85],[111,91]])}else{line([[100,65],[100,145]]);line([[85,146],[115,146]]);rect(83,69,35,37);line([[78,69],[101,54],[122,69]])}break;
 case'tram':case'train':rect(61,82,79,51);for(let i=0;i<3;i++)rect(69+i*22,91,15,20);circle(76,140,7);circle(126,140,7);line([[67,76],[133,76]]);line([[91,76],[111,64],[100,56],[89,64],[100,76]]);break;
 case'ticket':rect(48,78,104,56);line([[116,78],[116,134]]);for(let i=0;i<4;i++)line([[61,91+i*9],[102,91+i*9]]);circle(135,105,9);break;
 case'cafe':cup();line([[49,72],[145,72]]);break;
 case'cat':line([[79,111],[74,77],[91,88],[112,87],[129,75],[127,115]],true);curve([79,111,65,146,132,149,127,115]);line([[89,103],[94,103]]);line([[110,103],[116,103]]);line([[99,112],[104,115],[109,111]]);break;
 case'palm':case'island':curve([96,138,108,113,113,83,105,71]);for(const [a,b,c,d]of[[65,60,69,88],[147,59,151,85],[84,43,104,71],[131,43,133,72]])curve([105,71,a,b,c,d,105,71]);arc(102,159,58,Math.PI*1.12,Math.PI*1.9);break;
 case'fish':ctx.beginPath();ctx.moveTo(53,105);ctx.bezierCurveTo(80,70,122,77,136,104);ctx.bezierCurveTo(113,137,77,136,53,105);ctx.stroke();line([[136,104],[153,84],[153,125],[136,104]]);circle(72,102,3);line([[96,90],[104,78],[115,89]]);break;
 case'snorkel':rect(57,90,81,35);circle(78,108,12);circle(117,108,12);line([[138,108],[150,108],[150,66],[137,66]]);break;
 case'coconut':circle(100,105,34);line([[70,91],[131,91]]);line([[103,91],[116,61],[136,61]]);flower();break;
 case'shell':ctx.beginPath();ctx.moveTo(100,139);ctx.bezierCurveTo(20,102,68,50,100,71);ctx.bezierCurveTo(140,48,181,106,100,139);ctx.stroke();for(let i=0;i<5;i++)line([[100,139],[65+i*17,83-i%2*9]]);break;
 case'hourglass':line([[73,65],[129,65],[129,77],[78,132],[78,145],[125,145],[125,132],[73,77],[73,65]]);line([[69,59],[133,59]]);line([[69,151],[133,151]]);break;
 case'cup':cup();break;
 default:plane();
 }
 // Small serial-specific accents distinguish related motifs across collections.
 ctx.lineWidth=.7;const accent=item.number%3;
 if(accent===0){circle(45,58,1.5);circle(151,141,1.2)}else if(accent===1){line([[44,73],[51,73]]);line([[148,137],[156,137]])}else star(144,58,3);
 ctx.font='500 11px "Microsoft YaHei", sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.fillText(item.name,100,item.frame===1?151:157,125);
 ctx.font='8px "Segoe UI", sans-serif';ctx.fillText('FLIGHT ATLAS  ·  '+String(item.number).padStart(3,'0'),100,item.frame===1?61:46,122);
 ctx.restore();
}
module.exports={draw};
