# Static browser resources: source and package

CodeON keeps browser resources in two trees. `OpenRobertaServer/staticResources`
is the development source used by `ora.sh start-from-git`. The normal local
starter serves `application/staticResources`. The `ora.sh` export step copies
the source tree into the application package. A fix present only in the source
tree can therefore appear to work in development but be absent from an installed
CodeON package.

Run `npm run test:static-resources` after changes to either tree. The test checks
the full relative file inventory and byte equality of HTML, CSS, SVG and JSON
resources. It also requires the inactive-tab CSS rule in `css/style.css`, because
omitting it can cause hidden tabs to intercept clicks. This contract runs in the
architecture CI workflow and does not start a server or access hardware.

JavaScript is not generally byte-compared because TypeScript build output may
be unminified in the source tree and minified in the package. The same test
therefore exercises one critical packaged behavior directly: the interpreter
must honor `closeBehaviourOnTermination=false` for forced and natural program
termination, while the default/true mode must still close the behaviour. This
guards shared robot-bridge tasks without changing the behavior of other robots.
For the remaining RCX JavaScript difference, the test compares the source and
package modules with one and four configured sensors. It checks sensor placement,
overlay invocation, and the RCX rule that program end does not reset motors.
This is a focused behavior check, not proof of complete module equivalence.

The 2026-10-10 inventory found 812 source files and 802 packaged files. Of 802
common files, 84 JavaScript files and one CSS file differed. The CSS copy has
been synchronized. Ten files exist only in the source tree: two images and
eight source maps. The JavaScript and source-only files are deliberately outside
this parity test: their generation, packaging and runtime use need a separate
provenance review before any synchronization. Do not bulk-copy them on the
strength of this test.

A read-only follow-up on 2026-10-10 used the locally installed Terser version
to minify the 84 differing source JavaScript files in memory. Ten matched the
package exactly, and 72 more matched after stripping source-map trailers.
Two did not: `interpreter.interpreter.js` and `robot.rcx.js`. The interpreter
had a real behavioral omission: the package lacked the seventh constructor
argument added to the TypeScript/source build and always closed the robot
behaviour on task termination. Its packaged copy was regenerated from the
current source and checked in both close modes. `robot.rcx.js` differs after
minification by almost no size and by local variable naming. The focused RCX
behavior checks match, so the existing package file stays untouched. Complete
semantic equivalence of the two generated modules is not claimed; no bulk
rewrite is made for it.
