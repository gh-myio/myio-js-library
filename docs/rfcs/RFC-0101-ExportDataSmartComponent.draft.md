temos que construir um componente novo

exemplo:

buildTemplateExport (docTypeExport)

que deve definir o formato de exportação para
PDF
XLS
CSV

temos que mapear as opções por exemplo
gráfico para 1 device com domain de temperature / water / energy
PDF - formato estilo cores da MYIO, com cabeçalho, header do nome do customer / shopping
mostrar o identifier do device, label (se for null mostrar name) o ícone e etc
aí podemos anexar uma grid de dados em tabela e até gráfico do período
a grid formatada com os dados
podemos buscar colocar o mínimo, máximo, média do período
XLS analogamente acima mas algo mais focado em dados em grid para o período
CSV analogamente acima (aqui o ideal é algo mais clean clean clean possível)

o nome dos dos arquivos exportados devem conter o nome do device, identifier (se existir), e domain, ano, mês, dia, hora, min e seg da exportação

exemplo
Burguer_king-113CD-ENERGIA-2025-12-08-12-47-00.pdf
Burguer_king-113CD-ENERGIA-2025-12-08-12-47-00.xlsx
Burguer_king-113CD-ENERGIA-2025-12-08-12-47-00.csv

na verdade queria construir 2 componentes

1 - const configMyioExportData = buildTemplateExport(parametros: - domain: energy | water | temperature , - formatExport: pdf | xlsx | csv - typeExport: one-device | comparasion | one-customer - group-of-customer - colorsPallet (optional) )

esse componente iria montar uma espécie de esqueleto padrão
2 - myioExportData (data , configMyioExportData)

aqui iria exportar os dados de fato

temos que colocar uns exemplos com dados mock variados no showcase
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\showcase
