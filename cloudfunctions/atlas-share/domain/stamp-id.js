// Shared shape validation; entitlement checks are handled by stamp-library.
function normalize(id){return typeof id==='string'&&/^stamp-(?:0(?:0[1-9]|[1-9]\d)|100)$/.test(id)?id:null}
module.exports={normalize};
