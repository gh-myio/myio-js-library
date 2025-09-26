// internal/DataTable/DataTable.ts
export interface Column<T> { 
  key: keyof T | string; 
  title: string; 
  align?: 'left'|'right'; 
  render?: (row:T)=>string; 
  sort?: (a:T,b:T)=>number; 
  width?: string; 
}

export function renderDataTable<T>(rows: T[], cols: Column<T>[], opts?: { zebra?: boolean; stickyHeader?: boolean }) {
  // returns HTMLElement table with sorting handlers bound on header cells
  const table = document.createElement('table');
  table.className = 'myio-data-table';
  
  // Create header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  
  cols.forEach(col => {
    const th = document.createElement('th');
    th.textContent = col.title;
    th.style.textAlign = col.align || 'left';
    if (col.width) th.style.width = col.width;
    if (opts?.stickyHeader) th.style.position = 'sticky';
    headerRow.appendChild(th);
  });
  
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // Create body
  const tbody = document.createElement('tbody');
  
  rows.forEach((row, index) => {
    const tr = document.createElement('tr');
    if (opts?.zebra && index % 2 === 1) {
      tr.style.backgroundColor = '#f5f5f5';
    }
    
    cols.forEach(col => {
      const td = document.createElement('td');
      const value = col.render ? col.render(row) : String(row[col.key as keyof T] || '');
      td.textContent = value;
      td.style.textAlign = col.align || 'left';
      tr.appendChild(td);
    });
    
    tbody.appendChild(tr);
  });
  
  table.appendChild(tbody);
  return table;
}
