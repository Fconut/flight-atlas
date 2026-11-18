Component({options:{virtualHost:true},properties:{stampId:String},methods:{ready(){this.triggerEvent('ready')},failed(){this.triggerEvent('failed')}}});
