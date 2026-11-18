Component({ methods:{assetLoaded(){this.triggerEvent('assetready')},assetFailed(){this.triggerEvent('asseterror')}}, properties: { src: String, transform: String, size: {type:Number,value:230} } });
