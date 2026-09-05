const DB={ get(k,d){try{return JSON.parse(localStorage.getItem("lingua:"+k))??d}catch(e){return d}},
  set(k,v){localStorage.setItem("lingua:"+k,JSON.stringify(v))},
  remove(k){localStorage.removeItem("lingua:"+k)},
  clearAll(){Object.keys(localStorage).filter(x=>x.startsWith("lingua:")).forEach(x=>localStorage.removeItem(x))} };

export { DB };
