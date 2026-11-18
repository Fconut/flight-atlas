const test = require('node:test');
const assert = require('node:assert/strict');
const type = require('../miniprogram/lib/poster-type');
function context() {
  const stack=[], draws=[];
  return { font:'10px sans-serif', textAlign:'left', fillStyle:'#000', draws,
    save() {stack.push({font:this.font,textAlign:this.textAlign,fillStyle:this.fillStyle});},
    restore() {Object.assign(this,stack.pop());},
    measureText(value) {const size=Number(this.font.match(/([\d.]+)px/)[1]);return {width:Array.from(value).reduce((n,c)=>n+size*(c.charCodeAt(0)>255?1:0.55),0)};},
    fillText(value,x,y) {draws.push({value,x,y,width:this.measureText(value).width,font:this.font,color:this.fillStyle});}
  };
}
test('long mixed-size airport names fit their cell while retaining the code and hierarchy', () => {
  const ctx=context();
  const result=type.runs(ctx,[{text:'这是一个非常非常长的国际机场名称 ✈',size:21,spacing:1,color:'#fff'},
    {text:'SHA',size:17,spacing:1,gap:7,color:'#gold'}],777.5,850,210.5,'left',13/21);
  assert(result.width<=210.5);
  assert.equal(result.runs[1].text,'SHA');
  assert(result.runs[0].text.endsWith('…'));
  assert(result.runs[1].size<result.runs[0].size);
  assert(ctx.draws.every(d=>d.x+d.width<=988.001));
});
test('large numbers keep small units and right alignment without crossing their cell', () => {
  const ctx=context();
  const result=type.runs(ctx,[{text:'123,456,789,012,345',size:21,color:'#gold'},
    {text:'km',size:12,gap:5,color:'#grey'}],520,1047,132,'right',14/21);
  assert(result.width<=132);
  assert.equal(result.runs[1].text,'km');
  assert(ctx.draws.at(-1).font.includes(type.FONT_FAMILY));
  assert(ctx.draws.every(d=>d.x>=388-0.001&&d.x+d.width<=520.001));
});
test('manual title spacing uses the same measurement for centered and drawn text', () => {
  const ctx=context(),run={text:'足迹的边界',size:22,spacing:5};
  const width=type.measure(ctx,run);
  type.text(ctx,run.text,540,778,22,'#gold',5,'500','center');
  assert.equal(ctx.draws.length,5);
  assert.equal(ctx.draws[0].x,540-width/2);
  assert.equal(ctx.draws.at(-1).x+ctx.draws.at(-1).width,540+width/2);
});
