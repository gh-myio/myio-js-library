// FilterableCardGrid.css.ts
export const FILTERABLE_GRID_CSS = `
/* FilterableCardGrid Styles - MYIO Design System */
.myio-filterable-grid {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-family: 'Roboto', Arial, sans-serif;
}

.myio-filter-bar {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e0e0e0;
  box-shadow: 0 2px 6px rgba(0,0,0,0.08);
  flex-wrap: wrap;
}

.myio-filter-bar .search-section {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 280px;
}

.myio-filter-bar .search-input {
  width: 100%;
  max-width: 350px;
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  transition: border-color 0.2s;
}

.myio-filter-bar .search-input:focus {
  outline: none;
  border-color: #7C3AED;
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.1);
}

.myio-filter-bar .filter-section {
  display: flex;
  align-items: center;
  gap: 16px;
}

.myio-filter-bar .filter-button {
  background: #7C3AED;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  transition: background-color 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.myio-filter-bar .filter-button:hover {
  background: #6D28D9;
}

.myio-filter-bar .filter-button:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.3);
}

.myio-filter-bar .selection-counter {
  font-size: 14px;
  color: #666;
  white-space: nowrap;
}

.myio-filter-bar .bulk-actions {
  display: flex;
  gap: 8px;
}

.myio-filter-bar .bulk-export {
  background: #4b5563;
  color: white;
  border: none;
  padding: 8px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  transition: background-color 0.2s;
}

.myio-filter-bar .bulk-export:hover {
  background: #374151;
}

.myio-grid-container {
  position: relative;
  min-height: 200px;
}

.myio-card-grid {
  display: grid;
  grid-template-columns: var(--grid-columns, repeat(auto-fit, minmax(280px, 1fr)));
  gap: var(--grid-gap, 16px);
  padding: 16px;
  background: #f7f7f7;
  border-radius: 10px;
  min-height: 400px;
}

.myio-card-wrapper {
  position: relative;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.myio-card-wrapper:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.myio-empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #666;
  background: #fff;
  border-radius: 10px;
  border: 2px dashed #e0e0e0;
  margin: 16px;
}

.myio-empty-state .empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.6;
}

.myio-empty-state .empty-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #333;
}

.myio-empty-state .empty-desc {
  font-size: 14px;
  opacity: 0.8;
}

.myio-loading-state {
  text-align: center;
  padding: 40px 20px;
  color: #666;
  background: #fff;
  border-radius: 10px;
  margin: 16px;
}

.myio-loading-state .loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e0e0e0;
  border-top: 3px solid #7C3AED;
  border-radius: 50%;
  animation: myio-spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes myio-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.myio-default-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e0e0e0;
  box-shadow: 0 2px 6px rgba(0,0,0,0.08);
  transition: all 0.2s ease;
}

.myio-default-card .card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.myio-default-card .card-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  flex: 1;
  margin-right: 12px;
}

.myio-default-card .card-body {
  margin-bottom: 16px;
}

.myio-default-card .consumption {
  font-size: 24px;
  font-weight: 700;
  color: #28a745;
  margin-bottom: 4px;
}

.myio-default-card .device-type {
  font-size: 13px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.myio-default-card .card-actions {
  display: flex;
  gap: 8px;
  border-top: 1px solid #e0e0e0;
  padding-top: 16px;
}

.myio-default-card .card-actions button {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  transition: all 0.2s;
}

.myio-default-card .card-actions button:hover {
  background: #f7f7f7;
  border-color: #7C3AED;
  color: #7C3AED;
}

/* Responsive design */
@media (max-width: 768px) {
  .myio-filter-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .myio-filter-bar .search-section {
    min-width: auto;
  }

  .myio-filter-bar .filter-section {
    justify-content: space-between;
  }

  .myio-card-grid {
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 12px;
  }
}

@media (max-width: 480px) {
  .myio-filterable-grid {
    gap: 12px;
  }

  .myio-filter-bar {
    padding: 12px;
  }

  .myio-filter-bar .filter-section {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
}
`;