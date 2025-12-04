RFC: Alarm Profiles Panel Widget

Version: 0.3.0
Status: Draft
Author: MYIO Engineering
Created: 2025-11-27
Target Platform: ThingsBoard (Custom Widget)

0. Summary

This RFC defines the Alarm Profiles Panel Widget for the MYIO ThingsBoard ecosystem.

The widget is centered on Device Profiles (ThingsBoard Device Profiles), their Alarm Rules, and the associated Rule Chains. It provides two main operational views driven by multi-selected device profiles:

Devices View – a grid of devices associated with the selected device profiles.

Alarms View – a list/grid of recent alarms generated for those device profiles, with filters.

Additionally, for each Device Profile, the widget:

Shows the associated Rule Chain name inline in the multi-select list (small, italic text in parentheses).

Provides a Profile Details Modal, accessible via a small “info/plus” button next to the profile, containing:

A descriptive text about the device profile

Alarm Rules overview

Rule Chain information

The widget will be delivered as a standard ThingsBoard custom widget with four files:

JavaScript controller

HTML template

CSS stylesheet

Settings schema

1. Motivation

Operators need a profile-centric, alarm-aware panel that answers:

Which device profiles exist and what do they represent?

Which Rule Chain is responsible for processing alarms for each device profile?

Which devices belong to those profiles?

Which alarms have been recently generated under those profiles, and what rules triggered them?

Today, these answers are scattered:

Device Profiles and Alarm Rules live in configuration screens.

Rule Chains are configured elsewhere.

Alarm lists are generally global or device-centric.

This widget consolidates all of that into one operational UI, enabling:

Multi-select of relevant device profiles

Immediate visibility of Rule Chains per device profile

Quick inspection of device profile details (description + rules + Rule Chain)

Easy switching between Devices and Alarms views

2. Goals & Non-Goals
   2.1. Goals

Provide a multi-select list of Device Profiles:

Show profile name

Show associated Rule Chain name inline, in small italic text

Provide a “more info” / “i” button per profile to open a Profile Details Modal

Provide a Devices View:

Grid of devices mapped to the selected device profiles

Provide an Alarms View:

List/grid of recent alarms filtered by:

Selected device profiles

Date interval

Alarm status (ACTIVE, CLEARED, ACKNOWLEDGED, etc.)

One card per alarm with key information: timestamp, profile, rule, device, reason

Expose Alarm Rules and Rule Chain information per device profile in a readable way

Keep behavior configurable via widget settings

2.2. Non-Goals

Editing device profiles, alarm rules, or rule chains

Creating, acknowledging, or clearing alarms

Implementing full alarm analytics (KPIs, MTBF/MTTR, trends)

Managing multi-tenant security or backend rule deployment

3. High-Level Design
   3.1. Layout Overview

The widget layout consists of:

Header

Optional title, subtitle and refresh button

Device Profile Selector (Multi-Select)

Displays all relevant Device Profiles

Each entry shows:

Profile Name

Rule Chain Name in parentheses, small italic font

Example: Chiller Profile ( _RC-Chiller-Default_ )

A “details” icon/button (e.g., i or +) to open the Profile Details Modal

Supports multi-selection

View Mode Toggle

Two modes:

Devices – shows Devices Grid

Alarms – shows Alarms Grid / Cards

Main Content Area

In Devices View:

Grid listing devices mapped to the selected device profiles

In Alarms View:

Filters: date interval, alarm status

Cards/rows: recent alarms for the selected profiles

Profile Details Modal

Shows:

Profile name, code

Associated Rule Chain name (and optionally ID)

Profile descriptive text (long description)

Alarm Rules overview (read-only)

Alarm Rules Modal / Section

Conceptually part of the Profile Details Modal:

Either a separate section/tab inside the same modal

Or a structured block within the profile details content

4. Data Model

The widget consumes three conceptual data sets:

Device Profiles Data

Devices Data

Alarms Data

4.1. Device Profiles Data

Represents ThingsBoard Device Profiles with their alarm and rule-flow definitions.

Minimum fields:

profileId – unique identifier (e.g., Device Profile entity ID)

profileName – user-friendly profile name

profileCode – optional short code

profileDescriptionShort – short description (for inline hints)

profileDescriptionLong – longer description (for Profile Details Modal)

alarmRules – structured representation of alarm rules (JSON or similar)

ruleChainId – identifier of the Rule Chain associated to this profile

ruleChainName – human-readable name of the Rule Chain

Usage:

Multi-select list: profileName + (ruleChainName)

Profile Details Modal: show ruleChainName, profileDescriptionLong, alarmRules

4.2. Devices Data

Devices bound to specific device profiles.

Minimum fields:

deviceId

deviceName

deviceLabel (optional)

location (store, area, etc., optional)

deviceProfileId (link to profileId)

currentAlarmSeverity

alarmStatus (ACTIVE, CLEARED, ACKNOWLEDGED, NORMAL…)

lastAlarmTs

Usage:

Devices View grid

4.3. Alarms Data

Individual alarm events related to devices belonging to the selected device profiles.

Minimum fields:

alarmId

deviceId

deviceName

deviceProfileId

deviceProfileName

ruleChainName (optional, if available)

alarmTs

alarmStatus (ACTIVE, CLEARED, ACKNOWLEDGED, etc.)

severity (CRITICAL, MAJOR, MINOR, WARNING, INFO, NONE…)

ruleName – the rule that generated the alarm

ruleId (optional)

reason / message – short description / reason

Usage:

Alarms View alarm cards

5. Interaction Model
   5.1. Device Profile Multi-Select

Each profile is rendered as a selectable pill/card.

Layout example:

Line 1: Profile Name

Line 2: (_Rule Chain Name_) in small italic font

A small “info/plus” icon appears on the right side of the pill:

Clicking the icon opens the Profile Details Modal

Clicking the main area of the pill toggles selection state

Multiple profiles can be selected simultaneously.

5.2. Profile Details Modal

When the user clicks the info/plus button on a profile:

Open a modal titled: “Device Profile Details: <Profile Name>”

The modal includes at least the following info:

Profile name and code

Rule Chain name (and optionally ID)

Long description / documentation text

Alarm Rules overview:

Could be formatted as json or summarized (e.g., rules list with severity and condition)

The modal is purely informational, read-only.

The modal closes via:

Close button (X)

Optional overlay click

5.3. View Mode Toggle

Two states:

Devices

Alarms

Shared state:

Selected device profiles

Do not reset when switching views

5.4. Devices View

Shows a grid of devices filtered by selected device profiles.

If no profiles are selected:

Show hint: “Select one or more device profiles to see devices.”

If there are selected profiles but no devices:

Show message: “No devices found for the selected profiles.”

Columns are configurable via settings (Device, Location, Severity, Status, Last Alarm).

5.5. Alarms View

Shows filter controls:

Date Interval (start / end)

Alarm Status (multi-select or pre-defined choices)

Alarm list as cards or rows, each showing:

Alarm timestamp

Device name

Device profile name

Severity badge

Alarm status

Rule name

Reason/message

Default sort:

Most recent alarms first (descending alarmTs)

If filters or selections produce no alarms:

Show empty state messaging.

6. Settings Schema – Extended Mapping

The Settings must support mapping and configuration for:

6.1. Appearance

showHeader

headerTitle

compactMode

6.2. Device Profile Mapping

profileIdKey

profileNameKey

profileCodeKey

profileDescriptionShortKey

profileDescriptionLongKey

alarmRulesKey

ruleChainIdKey

ruleChainNameKey

6.3. Devices View

Toggle column visibility: location, severity, status, last alarm

Column ordering (optional)

6.4. Alarms View

Default date interval (e.g., last 24h)

Default status filter (ACTIVE, ACKNOWLEDGED, etc.)

Max number of alarms to display

6.5. Styles & Badges

Severity classes: CRITICAL, MAJOR, MINOR, WARNING, INFO, NONE

Status classes: ACTIVE, CLEARED, ACKNOWLEDGED, NORMAL

Optional classes for profile pills and Rule Chain text (e.g., specific color for Rule Chain name).

7. UX & Visual Notes

Rule Chain name must be visually subordinate to the profile name:

Smaller font

Italic

Wrapped in parentheses

Example: Chiller Profile ( _RC-Chiller-Default_ )

Profile Details Modal should feel like a documentation snippet:

Short textual explanation of what this profile represents

Clear indication of which Rule Chain runs for this profile

The widget should maintain a compact, dashboard-friendly layout, avoiding excessive vertical scrolling where possible.

8. Risks & Mitigations
   Risk Description Mitigation
   Missing Rule Chain mapping Some device profiles may not have rule chain info accessible Allow Rule Chain name to be optional; show “No Rule Chain configured”
   Overloaded Profile Details Modal Too many fields can overwhelm the operator Keep layout simple: profile meta + description + high-level rules overview
   Data inconsistency Alarm data may not include direct profile or rule chain references Use device → device profile association to enrich alarm data where possible
9. Future Enhancements

Tabs within Profile Details Modal (e.g., “Overview”, “Alarm Rules”, “Rule Chain Flow”).

Link from Rule Chain name to a Rule Chain visualization or documentation.

Richer alarm rule visualization (conditions, thresholds, actions).

Profile-level KPIs (number of alarms, average severity, etc.).

10. Conclusion

By incorporating Rule Chain awareness and a Profile Details Modal, the Alarm Profiles Panel Widget becomes not only a live operational tool for Devices and Alarms, but also a contextual documentation surface for each Device Profile. Operators can see, in one consolidated UI:

Which profiles are active,

Which Rule Chains drive their alarms,

What each profile conceptually represents,

And how devices and alarms relate to those profiles.

This design aligns with MYIO’s need for transparency, operational clarity, and future extensibility on top of ThingsBoard’s device profile and rule chain concepts.
