# Automation Backup Files

This directory contains backup files for automation logic from all myio units.

## 📁 Directory Structure

```
bkp/
├── BENFICA/
│   └── automacao-Benfica-bkp-001.js
├── CAXIAS/
│   └── automacao-Caxias-bkp-001.js
├── GUADALUPE/
│   ├── automacao-Guadalupe-bkp-001.js
│   ├── automacao-Guadalupe-bkp-002.js
│   └── automacao-Guadalupe-bkp-003.js
├── JACAREPAGUA/
│   └── automacao-Jacarepagua-bkp-001.js
├── MESQUITA/
│   └── automacao-Mesquita-bkp-001.js
├── MOOCA/
│   └── automacao-Mooca-bkp-001.js
├── PIRACICABA/
│   └── automacao-Piracicaba-bkp-001.js
├── PRAIA-GRANDE/
│   └── automacao-PraiaGrande-bkp-001.js
└── SUZANO/
    └── automacao-Suzano-bkp-001.js
```

## 🎯 Purpose

These backup files serve as:
- **Rollback points** for production automation code
- **Historical reference** for code changes
- **Disaster recovery** snapshots

## 📝 Naming Convention

```
automacao-{UnitName}-bkp-{VersionNumber}.js
```

**Examples:**
- `automacao-Guadalupe-bkp-001.js`
- `automacao-Mesquita-bkp-002.js`
- `automacao-PraiaGrande-bkp-001.js`

## 🏢 Units

| Unit | Location | Status |
|------|----------|--------|
| **BENFICA** | Rio de Janeiro, RJ | ✅ Active |
| **CAXIAS** | Duque de Caxias, RJ | ✅ Active |
| **GUADALUPE** | Rio de Janeiro, RJ | ✅ Active |
| **JACAREPAGUA** | Rio de Janeiro, RJ | ✅ Active |
| **MESQUITA** | Mesquita, RJ | ✅ Active |
| **MOOCA** | São Paulo, SP | ✅ Active |
| **PIRACICABA** | Piracicaba, SP | ✅ Active |
| **PRAIA-GRANDE** | Praia Grande, SP | ✅ Active |
| **SUZANO** | Suzano, SP | ✅ Active |

## 🔄 Version Control

### Creating a New Backup

When making significant changes to automation code:

1. **Increment version number:**
   ```bash
   # Example for MESQUITA unit
   automacao-Mesquita-bkp-002.js  # New version
   ```

2. **Add header with metadata:**
   ```javascript
   /**
    * Automation Backup - MESQUITA Unit
    *
    * @unit MESQUITA
    * @created 2025-11-24
    * @version bkp-002
    * @changes Fixed midnight crossing bug
    */
   ```

3. **Copy current production code:**
   - Export from Node-RED function node
   - Paste into backup file
   - Add comments explaining changes

### Rollback Procedure

To rollback to a previous version:

1. Identify the backup version to restore
2. Copy content from backup file
3. Paste into Node-RED function node
4. Deploy changes
5. Monitor logs for issues

## 📊 Backup Policy

- **Frequency:** Before major changes
- **Retention:** Keep last 3 versions per unit
- **Archive:** Move older versions to `archive/` subfolder
- **Documentation:** Always document what changed

## ⚠️ Important Notes

1. **Never delete backups** without team approval
2. **Test rollbacks** in staging before production
3. **Document changes** in file header and commit message
4. **Notify team** when creating new backups

## 🔍 Finding Backups

**Search for unit backups:**
```bash
# All backups for GUADALUPE
find . -path "./GUADALUPE/*.js"

# Latest backup for all units
find . -name "*bkp-001.js"

# All backups
find . -type f -name "*.js" | sort
```

## 📚 Related Documentation

- `../func-001-FeriadoCheck.js` - Main automation function
- `../lib/scheduleEngine.js` - Core scheduling logic
- `../BUG-FIX-HOLIDAY-FILTER.md` - Recent bug fix documentation
- `../LOG-RETENTION-STRATEGY.md` - Log management strategy

## 🚀 Quick Reference

**Create new backup for unit:**
```bash
# Example for BENFICA
cp current-code.js bkp/BENFICA/automacao-Benfica-bkp-002.js
```

**List all versions for a unit:**
```bash
ls -la bkp/GUADALUPE/
```

**Compare two versions:**
```bash
diff bkp/GUADALUPE/automacao-Guadalupe-bkp-001.js \
     bkp/GUADALUPE/automacao-Guadalupe-bkp-002.js
```

---

**Last Updated:** 2025-11-24
**Maintained By:** myio Development Team
