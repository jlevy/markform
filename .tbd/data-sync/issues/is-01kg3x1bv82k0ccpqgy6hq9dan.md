---
close_reason: null
closed_at: 2025-12-29T01:10:20.981Z
created_at: 2025-12-29T00:57:54.394Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.005Z
    original_id: markform-422
id: is-01kg3x1bv82k0ccpqgy6hq9dan
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Migrate example string-list fields to table-field format
type: is
updated_at: 2025-12-29T01:10:20.981Z
version: 1
---
Migrate structured string-list fields in examples to use the new table-field format where appropriate.

**Candidates for migration:**

**movie-research-basic.form.md:**
- notable_awards: Award | Category | Year

**movie-deep-research.form.md:**
- lead_cast: Actor Name | Character Name
- notable_awards: Award | Category | Year
- notable_quotes: Quote | Critic | Publication

**celebrity-deep-research.form.md:**
- causes_activism: Cause | Role/Involvement | Source
- education: Institution | Degree/Program | Years | Notes
- siblings: Name | Relationship | Notable info
- marriages: Spouse | Wedding Date | Divorce Date | Duration | Source
- children: Name | Birth Year | Other Parent | Notes
- notable_relationships: Partner Name | Dates | Reliability
- legal_cases: Case Type | Year | Parties | Outcome | Source
- arrests_charges: Year | Charge | Location | Outcome | Source
- controversies: Year | Issue | Description | Outcome | Reliability
- known_salaries: Project | Amount | Year | Source
- business_ventures: Company | Role | Industry | Status | Source
- endorsements: Brand | Type | Value | Years | Source
- real_estate: Property | Location | Price | Year | Source
- notable_interviews: Outlet/Show | Date | Topic | URL
- talk_show_appearances: Show | Date | Moment | URL
- notable_quotes: Quote | Context/Source

**startup-deep-research.form.md:**
- funding_rounds: Round Type | YYYY-MM | Amount | Lead Investor(s) | Source URL
- competitors: Company Name | Website | One-liner | Funding/Stage | Source URL
- hn_posts: Title | Date | Points | Comments | URL
- ph_launches: Product Name | Date | Upvotes | Badges | URL
- hiring_signals: Department | Roles | Notable positions
- podcast_interviews: Title | Podcast/Show | Date | URL
- press_coverage: Title | Publication | Date | URL

**earnings-analysis.form.md:**
- sources_accessed: Date | Source | Type | Link | Takeaways
- experts_list: Name | Angle | Lead time | Hit rate | Tier

**Acceptance criteria:**
- All candidates reviewed and migrated where appropriate
- Column types match supported types: string, number, url, date, year
- Each migrated field has appropriate minRows/maxRows if needed
- Instructions updated to remove pipe format hints (now handled by table columns)
