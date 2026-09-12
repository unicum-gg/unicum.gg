// The project's checks are type checking and ESLint. This is the one thing
// neither can see: the locale tree, which is 27 folders of generated JSON no
// reviewer reads, where a missing key or a dropped `{placeholder}` only ever
// surfaces on the page, in a language nobody on the team speaks.
import { localesTests } from "./validation/locales";

localesTests();
