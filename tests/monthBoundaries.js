const ymdLocal = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
for (const [yr, mIdx, name] of [[2026,8,'September 2026'],[2026,9,'October 2026']]) {
  const oldS = new Date(yr,mIdx,1).toISOString().slice(0,10), oldE = new Date(yr,mIdx+1,1).toISOString().slice(0,10)
  const newS = ymdLocal(new Date(yr,mIdx,1)),               newE = ymdLocal(new Date(yr,mIdx+1,1))
  console.log(name.padEnd(15), 'OLD  date >=', oldS, ' and date <', oldE, '   | NEW  date >=', newS, ' and date <', newE)
  console.log(''.padEnd(15), 'timestamp start (new):', new Date(yr,mIdx,1).toISOString(), ' = local midnight')
}
