// The project's checks are type checking and ESLint. These are what neither
// can see: the locale tree, which is 27 folders of generated JSON no
// reviewer reads, where a missing key or a dropped `{placeholder}` only ever
// surfaces on the page, in a language nobody on the team speaks; and a
// player's crests copied field by field, where a forgotten one compiles.
import { crestsTests } from "./validation/crests";
import { localesTests } from "./validation/locales";

localesTests();
crestsTests();
