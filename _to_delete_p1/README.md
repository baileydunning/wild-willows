Phase 1 leftovers — safe to delete this whole folder.

Files moved here because this shell cannot unlink (Cowork device bridge).
They are already removed from the build; `git rm` the tracked ones:

  git rm tests/integration/coop.test.ts tests/e2e/coop.spec.ts \
         src/ui/People.tsx src/ui/JoinApproval.tsx src/ui/JoinWaiting.tsx \
         src/features.ts

Then: rm -rf _to_delete_p1
