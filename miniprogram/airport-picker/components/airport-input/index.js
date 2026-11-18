const airports=require('../../airports'),names=require('../../../lib/names'),metadata=require('../../search-metadata'),Search=require('../../lib/airport-search');
let index;
Component({
 properties:{value:{type:String,value:'',observer(code){if(!code&&!this.editingQuery){this.setData({query:'',selectedCode:'',results:[],open:false});return}if(code&&airports[code]){this.editingQuery=false;this.setData({query:names[code]||airports[code].name||code,selectedCode:code,results:[],open:false})}}},label:String},
 lifetimes:{detached(){clearTimeout(this.blurTimer)}},
 data:{query:'',results:[],open:false,selectedCode:''},
 methods:{
  input(e){clearTimeout(this.blurTimer);this.editingQuery=true;index=index||Search.create(airports,names,metadata);const query=e.detail.value;this.setData({query,selectedCode:'',open:true,results:index.query(query,6)});this.triggerEvent('airportchange',{code:''})},
  focus(){clearTimeout(this.blurTimer);if(!this.data.selectedCode&&this.data.query){index=index||Search.create(airports,names,metadata);this.setData({open:true,results:index.query(this.data.query,6)})}},
  blur(){clearTimeout(this.blurTimer);this.blurTimer=setTimeout(()=>this.setData({open:false}),180)},
  choose(e){clearTimeout(this.blurTimer);this.editingQuery=false;const code=e.currentTarget.dataset.code;if(!airports[code])return;this.setData({query:names[code]||airports[code].name||code,selectedCode:code,results:[],open:false});this.triggerEvent('airportchange',{code})},
  clear(){clearTimeout(this.blurTimer);this.editingQuery=false;this.setData({query:'',selectedCode:'',results:[],open:false});this.triggerEvent('airportchange',{code:''})}
 }
});
