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

{% description ref="political_research" %}
A biographical research form for political figures based on Wikipedia's president infobox structure.
This form demonstrates role-based field assignment: the user provides the subject name,
and the agent researches and fills all remaining fields.
{% /description %}

{% documentation ref="political_research" %}
**Workflow:
1. User enters the political figure's name
2. Agent researches and fills biographical data using web search
3. Agent fills office history (up to 3 positions)
4. Agent includes source citations

**Data Sources:**
- Wikipedia biographical pages
- Official government websites
- Historical archives
{% /documentation %}

{% field-group id="basic_info" title="Basic Information" %}

{% string-field id="name" label="Full Name" role="user" required=true minLength=2 maxLength=200 %}
```value
Abraham Lincoln
```
{% /string-field %}

{% instructions ref="name" %}
Enter the full name of the political figure you want to research (e.g., "Abraham Lincoln").
{% /instructions %}

{% string-field id="portrait_description" label="Portrait Description" maxLength=500 %}
```value
The famous 1863 Alexander Gardner photograph showing Lincoln in three-quarter profile, taken just before his Gettysburg Address. Lincoln appears contemplative, with his distinctive beard and formal attire that became iconic representations of the 16th President.
```
{% /string-field %}

{% instructions ref="portrait_description" %}
Describe the official portrait or most commonly used photograph. 50-100 words max.
{% /instructions %}

{% string-field id="birth_date" label="Birth Date" required=true pattern="^\\d{4}-\\d{2}-\\d{2}$" %}
```value
1809-02-12
```
{% /string-field %}

{% instructions ref="birth_date" %}
Format: YYYY-MM-DD (e.g., 1809-02-12)
{% /instructions %}

{% string-field id="birth_place" label="Birth Place" required=true %}
```value
Hodgenville, Kentucky
```
{% /string-field %}

{% instructions ref="birth_place" %}
Format: City, State/Country (e.g., Hodgenville, Kentucky)
{% /instructions %}

{% string-field id="death_date" label="Death Date" pattern="^\\d{4}-\\d{2}-\\d{2}$" %}
```value
1865-04-15
```
{% /string-field %}

{% instructions ref="death_date" %}
Format: YYYY-MM-DD. Leave empty if the person is still living.
{% /instructions %}

{% string-field id="death_place" label="Death Place" %}
```value
Washington, D.C.
```
{% /string-field %}

{% instructions ref="death_place" %}
Format: City, State/Country. Leave empty if the person is still living.
{% /instructions %}

{% string-field id="cause_of_death" label="Cause of Death" %}
```value
Assassination
```
{% /string-field %}

{% instructions ref="cause_of_death" %}
Brief description if applicable (e.g., "Assassination", "Natural causes"). Leave empty if still living.
{% /instructions %}

{% string-field id="resting_place" label="Resting Place" %}
```value
Oak Ridge Cemetery, Springfield, Illinois
```
{% /string-field %}

{% instructions ref="resting_place" %}
Burial location if applicable (e.g., "Oak Ridge Cemetery, Springfield, Illinois").
{% /instructions %}

{% /field-group %}

{% field-group id="political_info" title="Political Affiliation" %}

{% string-field id="political_party" label="Political Party" required=true %}
```value
Republican
```
{% /string-field %}

{% instructions ref="political_party" %}
Primary party affiliation (e.g., "Republican", "Democratic").
{% /instructions %}

{% string-list id="other_parties" label="Other Party Affiliations" %}
```value
Whig
```
{% /string-list %}

{% instructions ref="other_parties" %}
List any previous party affiliations, one per line.
{% /instructions %}

{% /field-group %}

{% field-group id="personal_life" title="Personal Life" %}

{% string-field id="spouse" label="Spouse" %}
```value
Mary Todd Lincoln (1842-1865)
```
{% /string-field %}

{% instructions ref="spouse" %}
Format: Name (years married), e.g., "Mary Todd Lincoln (1842-1865)"
{% /instructions %}

{% string-list id="children" label="Children" %}
```value
Robert Todd Lincoln
Edward Baker Lincoln
William Wallace Lincoln
Thomas Lincoln III
```
{% /string-list %}

{% instructions ref="children" %}
List children's names, one per line.
{% /instructions %}

{% string-list id="parents" label="Parents" %}
```value
Thomas Lincoln
Nancy Hanks Lincoln
```
{% /string-list %}

{% instructions ref="parents" %}
List parents' names, one per line.
{% /instructions %}

{% string-list id="education" label="Education" %}
```value
Self-educated
```
{% /string-list %}

{% instructions ref="education" %}
List schools, degrees, or educational background, one per line.
{% /instructions %}

{% /field-group %}

{% field-group id="office_1" title="Office 1 (Most Recent)" %}

{% description ref="office_1" %}
Primary or most notable office held. Fill chronologically with most recent first.
{% /description %}

{% string-field id="office_1_title" label="Office Title" required=true %}
```value
16th President of the United States
```
{% /string-field %}

{% instructions ref="office_1_title" %}
Full title including ordinal if applicable (e.g., "16th President of the United States").
{% /instructions %}

{% string-field id="office_1_term_start" label="Term Start" required=true pattern="^\\d{4}-\\d{2}-\\d{2}$" %}
```value
1861-03-04
```
{% /string-field %}

{% instructions ref="office_1_term_start" %}
Format: YYYY-MM-DD
{% /instructions %}

{% string-field id="office_1_term_end" label="Term End" required=true pattern="^(\\d{4}-\\d{2}-\\d{2}|Incumbent)$" %}
```value
1865-04-15
```
{% /string-field %}

{% instructions ref="office_1_term_end" %}
Format: YYYY-MM-DD or "Incumbent" if currently serving.
{% /instructions %}

{% string-field id="office_1_preceded_by" label="Preceded By" %}
```value
James Buchanan
```
{% /string-field %}

{% instructions ref="office_1_preceded_by" %}
Name of the previous office holder.
{% /instructions %}

{% string-field id="office_1_succeeded_by" label="Succeeded By" %}
```value
Andrew Johnson
```
{% /string-field %}

{% instructions ref="office_1_succeeded_by" %}
Name of the next office holder, or empty if still in office.
{% /instructions %}

{% string-field id="office_1_running_mate" label="Running Mate / Vice President" %}
```value
Hannibal Hamlin (1861-1865), Andrew Johnson (1865)
```
{% /string-field %}

{% instructions ref="office_1_running_mate" %}
For presidential terms, list running mate(s) or Vice President(s).
{% /instructions %}

{% /field-group %}

{% field-group id="office_2" title="Office 2" %}

{% description ref="office_2" %}
Second most notable office held. Leave empty if not applicable.
{% /description %}

{% string-field id="office_2_title" label="Office Title" %}
```value
US Representative, Illinois 7th District
```
{% /string-field %}

{% string-field id="office_2_term_start" label="Term Start" pattern="^\\d{4}-\\d{2}-\\d{2}$" %}
```value
1847-03-04
```
{% /string-field %}

{% string-field id="office_2_term_end" label="Term End" pattern="^(\\d{4}-\\d{2}-\\d{2}|Incumbent)$" %}
```value
1849-03-04
```
{% /string-field %}

{% string-field id="office_2_preceded_by" label="Preceded By" %}
```value
John Henry
```
{% /string-field %}

{% string-field id="office_2_succeeded_by" label="Succeeded By" %}
```value
Thomas L. Harris
```
{% /string-field %}

{% string-field id="office_2_running_mate" label="Running Mate / Vice President" %}{% /string-field %}

{% /field-group %}

{% field-group id="office_3" title="Office 3" %}

{% description ref="office_3" %}
Third most notable office held. Leave empty if not applicable.
{% /description %}

{% string-field id="office_3_title" label="Office Title" %}
```value
Illinois State Representative
```
{% /string-field %}

{% string-field id="office_3_term_start" label="Term Start" pattern="^\\d{4}-\\d{2}-\\d{2}$" %}
```value
1834-12-01
```
{% /string-field %}

{% string-field id="office_3_term_end" label="Term End" pattern="^(\\d{4}-\\d{2}-\\d{2}|Incumbent)$" %}
```value
1842-12-05
```
{% /string-field %}

{% string-field id="office_3_preceded_by" label="Preceded By" %}{% /string-field %}

{% string-field id="office_3_succeeded_by" label="Succeeded By" %}{% /string-field %}

{% string-field id="office_3_running_mate" label="Running Mate / Vice President" %}{% /string-field %}

{% /field-group %}

{% field-group id="sources_section" title="Sources" %}

{% string-list id="sources" label="Sources" %}
```value
https://en.wikipedia.org/wiki/Abraham_Lincoln
https://www.whitehouse.gov/about-the-white-house/presidents/abraham-lincoln/
https://www.nps.gov/liho/learn/historyculture/index.htm
```
{% /string-list %}

{% instructions ref="sources" %}
List source URLs or citations used for research. Include Wikipedia and any additional sources consulted.
{% /instructions %}

{% /field-group %}

{% /form %}
