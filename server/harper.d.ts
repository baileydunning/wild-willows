// Harper globals, provided by the Harper JavaScript runtime at load time.
//
// These were `declare const` at the top of the old single-file server/resources.ts.
// Declaring them once here, globally, keeps every split module able to see them
// without re-declaring — and emits nothing, so the bundle is unchanged.

declare const databases: any;
declare const Resource: any;
