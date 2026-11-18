const test=require('node:test'),assert=require('node:assert/strict');
const palettes=require('../miniprogram/lib/airline-brand-colors');
const {airlineIdentity,contrast}=require('../miniprogram/lib/airline-identity');
const {airlineCardTheme,airlineCanvasBackground}=require('../miniprogram/lib/airline-card-theme');
test('all airline chips and card surfaces retain readable contrast',()=>{
 assert.equal(Object.keys(palettes).length,82);
 for(const code of Object.keys(palettes)){
 const identity=airlineIdentity({airline:code});assert(contrast(identity.color,identity.background)>=4.5,code);
 const stops=palettes[code].surface.match(/#[a-f0-9]{6}/gi);assert(stops.length,code);
 for(const color of stops)assert(contrast('#213c46',color)>=7,code+' surface');
 }
 assert.deepEqual(airlineCardTheme('AFR'),airlineCardTheme('AF'));
});
test('rainbow surfaces use valid canvas stops and preserve direction',()=>{
 const stops=[];const ctx={createLinearGradient(...args){assert(args.every(Number.isFinite));return {addColorStop(position,color){assert(position>=0&&position<=1);stops.push([position,color]);}}}};
 airlineCanvasBackground(ctx,'OA',0,0,896,140);assert.equal(stops.length,6);assert.equal(stops[0][0],0);assert.equal(stops.at(-1)[0],1);
 assert.equal(airlineCanvasBackground(ctx,'CZ',0,0,1,1).addColorStop instanceof Function,true);
 assert.equal(airlineCanvasBackground(ctx,'HO',0,0,1,1).addColorStop instanceof Function,true);
 assert.equal(airlineCardTheme('unknown').background,'#f4f6f3');
});
