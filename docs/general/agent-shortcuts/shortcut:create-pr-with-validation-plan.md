Shortcut: New PR and Validation Plan

Instructions:

Create a to-do list with the following items then perform all of them:

1. **Confirm feature docs:** Check if a Plan Spec and/or Implementation Spec are in
   scope or provided by the user.
   You should find them in @docs/project/specs/active/ with plan- and impl- prefixes
   (e.g., plan-YYYY-MM-DD-*.md and impl-YYYY-MM-DD-*.md).
   If isn’t clear, stop and ask!

2. **Create validation plan doc:** Copy @docs/project/specs/template-validation-spec.md
   to @docs/project/specs/active/valid-YYYY-MM-DD-feature-some-description.md (filling
   in the date and the appropriate description of the feature, matching the Plan Spec
   filename stem with valid- replacing plan-)

3. **Fill in the validation plan:** Fill in the template, in particular covering
   everything the user should validate.
   Don’t repeat things that are validated by automated tests!
   This is for manual validation.
   Be sure to ask for clarifications from the user if unsure how much to include.

4. **Ask for user review:** Summarize what you have done and ask the user to review.

5. **Review and commit:** Follow @shortcut:precommit-process.md and sure everything is
   committed. And that you’ve already followed the pre-commit rules before (or at least
   after) the last commit.
   If not, follow the full pre-commit review process and commit.

6. **Create or update PR:** Use the GitHub CLI (`gh`) to file or update an existing
   GitHub PR for the current branch.
   In the GitHub PR description be sure:

   - Give a full overview of changes, referencing the appropriate specs.
     Be complete but concise.
     The reviewer can click through to files and specs or architecture docs as needed
     for details.

   - Include the validation steps documented here are part of the GitHub PR. Be sure the
     PR description includes a section with Manual Validation and this would hold the
     content you wrote in the .valid.md file.

   - If you can’t run the GitHub CLI (`gh`) see
     @docs/general/agent-setup/github-cli-setup.md

7. **Validate CI:** Use the `gh` CLI to be sure the CI system runs and passes.

- Use `gh pr checks <pr_number>` to check on the build checks.

- If any are failing, try reproduce locally.

- If you can’t reproduce locally, review GitHub Actions configurations and debug why
  local build is not reproducible but CI build is failing.

- Make a fix and confirm it works on the next GitHub PR.

- You *MUST* make the build pass.
  If you cannot or don’t know how, tell the user and ask for help.

8. Update and sync all beads following the standard process.
