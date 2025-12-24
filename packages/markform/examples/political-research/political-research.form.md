---
markform:
  markform_version: "0.1.0"
  roles:
    - user
    - agent
  role_instructions:
    user: "Enter the full name of the political figure you want to research."
    agent: |
      Research and fill in all biographical fields for the specified political figure.
      Guidelines:
      1. Start with Wikipedia - The subject's Wikipedia page is the primary source
      2. Verify with multiple sources - Cross-reference dates and facts
      3. Use official formats - Dates as YYYY-MM-DD, places as "City, State/Country"
      4. Fill offices chronologically - Most recent first
      5. Include predecessors/successors - These provide historical context
      6. Leave unknown fields empty - Don't guess or fabricate information
      7. Keep text fields concise - Aim for 50-100 words max for descriptive fields
         (e.g., portrait_description, cause_of_death). Lists should have 3-10 items.
---

{% form id="political_research" title="Political Research Form" %}

{% doc ref="political_research" kind="description" %}
A biographical research form for political figures based on Wikipedia's president infobox structure.
This form demonstrates role-based field assignment: the user provides the subject name,
and the agent researches and fills all remaining fields.
{% /doc %}

{% doc ref="political_research" kind="instructions" %}
**Workflow:**
1. User enters the political figure's name
2. Agent researches and fills biographical data using web search
3. Agent fills office history (up to 3 positions)
4. Agent includes source citations

**Data Sources:**
- Wikipedia biographical pages
- Official government websites
- Historical archives
{% /doc %}

{% field-group id="basic_info" title="Basic Information" %}

{% string-field id="name" label="Full Name" role="user" required=true minLength=2 maxLength=200 %}{% /string-field %}

{% doc ref="name" kind="instructions" %}
Enter the full name of the political figure you want to research (e.g., "Abraham Lincoln").
{% /doc %}

{% string-field id="portrait_description" label="Portrait Description" maxLength=500 %}{% /string-field %}

{% doc ref="portrait_description" kind="instructions" %}
Describe the official portrait or most commonly used photograph. 50-100 words max.
{% /doc %}

{% string-field id="birth_date" label="Birth Date" required=true pattern="^\\d{4}-\\d{2}-\\d{2}$" %}{% /string-field %}

{% doc ref="birth_date" kind="instructions" %}
Format: YYYY-MM-DD (e.g., 1809-02-12)
{% /doc %}

{% string-field id="birth_place" label="Birth Place" required=true %}{% /string-field %}

{% doc ref="birth_place" kind="instructions" %}
Format: City, State/Country (e.g., Hodgenville, Kentucky)
{% /doc %}

{% string-field id="death_date" label="Death Date" pattern="^\\d{4}-\\d{2}-\\d{2}$" %}{% /string-field %}

{% doc ref="death_date" kind="instructions" %}
Format: YYYY-MM-DD. Leave empty if the person is still living.
{% /doc %}

{% string-field id="death_place" label="Death Place" %}{% /string-field %}

{% doc ref="death_place" kind="instructions" %}
Format: City, State/Country. Leave empty if the person is still living.
{% /doc %}

{% string-field id="cause_of_death" label="Cause of Death" %}{% /string-field %}

{% doc ref="cause_of_death" kind="instructions" %}
Brief description if applicable (e.g., "Assassination", "Natural causes"). Leave empty if still living.
{% /doc %}

{% string-field id="resting_place" label="Resting Place" %}{% /string-field %}

{% doc ref="resting_place" kind="instructions" %}
Burial location if applicable (e.g., "Oak Ridge Cemetery, Springfield, Illinois").
{% /doc %}

{% /field-group %}

{% field-group id="political_info" title="Political Affiliation" %}

{% string-field id="political_party" label="Political Party" required=true %}{% /string-field %}

{% doc ref="political_party" kind="instructions" %}
Primary party affiliation (e.g., "Republican", "Democratic").
{% /doc %}

{% string-list id="other_parties" label="Other Party Affiliations" %}{% /string-list %}

{% doc ref="other_parties" kind="instructions" %}
List any previous party affiliations, one per line.
{% /doc %}

{% /field-group %}

{% field-group id="personal_life" title="Personal Life" %}

{% string-field id="spouse" label="Spouse" %}{% /string-field %}

{% doc ref="spouse" kind="instructions" %}
Format: Name (years married), e.g., "Mary Todd Lincoln (1842-1865)"
{% /doc %}

{% string-list id="children" label="Children" %}{% /string-list %}

{% doc ref="children" kind="instructions" %}
List children's names, one per line.
{% /doc %}

{% string-list id="parents" label="Parents" %}{% /string-list %}

{% doc ref="parents" kind="instructions" %}
List parents' names, one per line.
{% /doc %}

{% string-list id="education" label="Education" %}{% /string-list %}

{% doc ref="education" kind="instructions" %}
List schools, degrees, or educational background, one per line.
{% /doc %}

{% /field-group %}

{% field-group id="office_1" title="Office 1 (Most Recent)" %}

{% doc ref="office_1" kind="description" %}
Primary or most notable office held. Fill chronologically with most recent first.
{% /doc %}

{% string-field id="office_1_title" label="Office Title" required=true %}{% /string-field %}

{% doc ref="office_1_title" kind="instructions" %}
Full title including ordinal if applicable (e.g., "16th President of the United States").
{% /doc %}

{% string-field id="office_1_term_start" label="Term Start" required=true pattern="^\\d{4}-\\d{2}-\\d{2}$" %}{% /string-field %}

{% doc ref="office_1_term_start" kind="instructions" %}
Format: YYYY-MM-DD
{% /doc %}

{% string-field id="office_1_term_end" label="Term End" required=true pattern="^(\\d{4}-\\d{2}-\\d{2}|Incumbent)$" %}{% /string-field %}

{% doc ref="office_1_term_end" kind="instructions" %}
Format: YYYY-MM-DD or "Incumbent" if currently serving.
{% /doc %}

{% string-field id="office_1_preceded_by" label="Preceded By" %}{% /string-field %}

{% doc ref="office_1_preceded_by" kind="instructions" %}
Name of the previous office holder.
{% /doc %}

{% string-field id="office_1_succeeded_by" label="Succeeded By" %}{% /string-field %}

{% doc ref="office_1_succeeded_by" kind="instructions" %}
Name of the next office holder, or empty if still in office.
{% /doc %}

{% string-field id="office_1_running_mate" label="Running Mate / Vice President" %}{% /string-field %}

{% doc ref="office_1_running_mate" kind="instructions" %}
For presidential terms, list running mate(s) or Vice President(s).
{% /doc %}

{% /field-group %}

{% field-group id="office_2" title="Office 2" %}

{% doc ref="office_2" kind="description" %}
Second most notable office held. Leave empty if not applicable.
{% /doc %}

{% string-field id="office_2_title" label="Office Title" %}{% /string-field %}

{% string-field id="office_2_term_start" label="Term Start" pattern="^\\d{4}-\\d{2}-\\d{2}$" %}{% /string-field %}

{% string-field id="office_2_term_end" label="Term End" pattern="^(\\d{4}-\\d{2}-\\d{2}|Incumbent)$" %}{% /string-field %}

{% string-field id="office_2_preceded_by" label="Preceded By" %}{% /string-field %}

{% string-field id="office_2_succeeded_by" label="Succeeded By" %}{% /string-field %}

{% string-field id="office_2_running_mate" label="Running Mate / Vice President" %}{% /string-field %}

{% /field-group %}

{% field-group id="office_3" title="Office 3" %}

{% doc ref="office_3" kind="description" %}
Third most notable office held. Leave empty if not applicable.
{% /doc %}

{% string-field id="office_3_title" label="Office Title" %}{% /string-field %}

{% string-field id="office_3_term_start" label="Term Start" pattern="^\\d{4}-\\d{2}-\\d{2}$" %}{% /string-field %}

{% string-field id="office_3_term_end" label="Term End" pattern="^(\\d{4}-\\d{2}-\\d{2}|Incumbent)$" %}{% /string-field %}

{% string-field id="office_3_preceded_by" label="Preceded By" %}{% /string-field %}

{% string-field id="office_3_succeeded_by" label="Succeeded By" %}{% /string-field %}

{% string-field id="office_3_running_mate" label="Running Mate / Vice President" %}{% /string-field %}

{% /field-group %}

{% field-group id="sources_section" title="Sources" %}

{% string-list id="sources" label="Sources" %}{% /string-list %}

{% doc ref="sources" kind="instructions" %}
List source URLs or citations used for research. Include Wikipedia and any additional sources consulted.
{% /doc %}

{% /field-group %}

{% /form %}
