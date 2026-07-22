---
name: reference_gh-pr-repo-target
description: "gh pr create/merge in cognify must pass --repo maxvolkov202/... or it targets Bob's upstream and fails"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 593b2f02-7f48-415d-9233-7feb12f19e53
---

In the cognify repo, `git remote` has **origin = `maxvolkov202/Cognify-Product-Description`** (Max's fork,
where branches are pushed and where main lives for this work) and **upstream = `bobsides-AICodebase/Cognify-Product-Description`** (Bob's repo, see [[user_bob-cto-partner]]).

`gh` resolves to the **upstream** by default, so a bare `gh pr create`/`gh pr merge` fails with
"Head sha can't be blank … No commits between main and <branch>" (it looks for the branch in Bob's repo, where it doesn't exist).

**Always pass `--repo maxvolkov202/Cognify-Product-Description`** to `gh pr create` and `gh pr merge`.
Squash-merge matches the repo's `(#NN)` commit-title convention. Push still works normally (origin).
