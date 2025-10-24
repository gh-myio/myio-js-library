🧩 Patch Request: Improve TelemetryInfo Layout and Logic
🎯 Goal

Refactor the TelemetryInfo panel to:

Remove the dark background and match the default MYIO dashboard theme colors.

Add correct consumer group logic (Climatization, Elevators, Escalators, Stores, Common Area).

Improve layout with 2 cards per row (e.g., “Entrada” and “Lojas” side-by-side).

🪄 Visual Adjustments

Remove the dark theme background — use same light mode colors as the rest of the dashboard.

Keep typography, borders, and spacing consistent with other panels.

Use existing MYIO palette:

Primary purple: #5B2EBC

Accent teal/green: #00C896

Background neutral: #FFFFFF

Text: #222222

Subtext: #666666

Keep the same rounded corners, shadows, and hover states used in the cards inside columns (“Entrada”, “Área Comum”, “Lojas”).

⚙️ Logic Adjustments — Consumers Section
New Consumer Categories

Refactor the Consumers breakdown using the following rules (case-insensitive):

Category	Inclusion Rule
Climatization	Devices whose label includes any of:
"Chiller", "Bomba", "Bomba Primária", "Bomba Secundária"
Elevators	Devices whose label includes "Elevador"
Esc. Rolantes	Devices whose label includes "Escada Rolante"
Lojas	All devices that belong to the datasource alias "Lojas"
Área Comum	Computed as:
Entrada total − (Climatização + Elevadores + Esc. Rolantes + Lojas)
🧱 Layout Structure

Arrange information cards two per row when possible:

Row	Left	Right
1	Entrada	Lojas
2	Climatização	Elevadores
3	Esc. Rolantes	Área Comum
4	Total (full width)	

Each card should include:

Title (category name)

Total (e.g., 63,16 MWh)

Percentage (if available)

Small progress bar or horizontal indicator (optional, reusing existing styles)

🧩 Technical Notes

Keep all numeric values formatted in MWh with two decimals.

Maintain consistency with the calculation methods already used for “Entrada” and “Área Comum”.

Ensure the logic runs after telemetry aggregation is complete (onDataUpdated or equivalent hook).

Add console logs for debugging category totals.

✅ Acceptance Criteria

 Dark background removed — uses light MYIO palette.

 Each consumer category computed according to rules.

 Cards appear in a 2-column responsive layout.

 Total matches the sum of all visible categories.

 No regression in existing “Entrada” or “Área Comum” values.

 Layout adapts correctly on smaller resolutions.