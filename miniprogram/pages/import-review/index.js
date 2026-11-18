const {readReview, decideReview} = require('../../lib/confirm-import');
Page({
 data: { ready: false, tab: 'added', visible: [], limit: 30, selectedCount: 0 },
 onLoad(options) {
  this.reviewToken = options.token;
  const review = readReview(this.reviewToken);
  if (!review) { this.setData({reviewError:'核对记录已失效，请返回重新导入'}); return; }
  this.review = review;
  this.selected = new Set([...review.groups.added, ...review.groups.updated].map(row => row.reviewId));
  const tab = review.added ? 'added' : review.updated ? 'updated' : 'duplicate';
  this.setData({...review, ready: true, tab});this.showRows();
 },
 showRows() {
  const rows = this.review?.groups[this.data.tab] || [];
  const selected = this.selected || new Set();
  this.setData({visible: rows.slice(0, this.data.limit).map(row => ({...row, selected:selected.has(row.reviewId)})), remaining:Math.max(0,rows.length-this.data.limit), selectedCount:selected.size, groupSelected:rows.filter(row=>selected.has(row.reviewId)).length});
 },
 select(e) {this.setData({tab:e.currentTarget.dataset.key,limit:30});this.showRows()},
 toggle(e) {
  if (this.data.tab==='duplicate'||this.confirmed) return;
  const id=Number(e.currentTarget.dataset.id);
  if (!this.review.groups[this.data.tab].some(row=>row.reviewId===id)) return;
  this.selected.has(id)?this.selected.delete(id):this.selected.add(id);this.showRows();
 },
 toggleAll() {
  if(this.data.tab==='duplicate'||this.confirmed)return;
  const rows=this.review.groups[this.data.tab],all=rows.every(row=>this.selected.has(row.reviewId));
  rows.forEach(row=>all?this.selected.delete(row.reviewId):this.selected.add(row.reviewId));this.showRows();
 },
 more(){this.setData({limit:this.data.limit+30});this.showRows()},
 confirm(){
  if(!this.data.ready||this.confirmed||((this.data.added||this.data.updated)&&!this.selected.size))return;
  this.confirmed=true;
  decideReview(this.reviewToken,[...this.selected]);
 },
 cancel(){wx.navigateBack()},
 onUnload(){if(!this.confirmed)decideReview(this.reviewToken,false)}
});
