---
markform:
  spec: MF/0.1
  title: Project Plan
  description: "Example plan document using implicit checkboxes - no explicit field wrappers needed."
  roles:
    - user
    - agent
  role_instructions:
    user: "Review the plan and update task status as work progresses."
    agent: "Track task completion and update checkbox states."
---
<!-- form id="project_plan" title="Project Plan" -->

<!-- description ref="project_plan" -->
A project plan demonstrating Markform's implicit checkboxes feature.
When a form has no explicit field tags, checkboxes are automatically
collected into an implicit `_checkboxes` field.
<!-- /description -->

## Phase 1: Research

- [ ] Review existing documentation <!-- #review_docs -->
- [ ] Analyze competitor solutions <!-- #competitor_analysis -->
- [ ] Interview stakeholders <!-- #stakeholder_interviews -->

## Phase 2: Design

- [ ] Create architecture document <!-- #arch_doc -->
- [ ] Design API specification <!-- #api_spec -->
- [ ] Review design with team <!-- #design_review -->

## Phase 3: Implementation

- [ ] Set up development environment <!-- #dev_setup -->
- [ ] Implement core functionality <!-- #core_impl -->
- [ ] Add unit tests <!-- #unit_tests -->
- [ ] Add integration tests <!-- #integration_tests -->

## Phase 4: Release

- [ ] Write user documentation <!-- #user_docs -->
- [ ] Perform security audit <!-- #security_audit -->
- [ ] Deploy to staging <!-- #staging_deploy -->
- [ ] Deploy to production <!-- #prod_deploy -->

<!-- /form -->
