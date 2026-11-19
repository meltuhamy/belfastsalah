// adhan-js publishes its Meeus implementation but does not export it from the
// package's entry point, and its type declarations live apart from the code,
// under lib/types. londonCalculation.ts imports the module itself.
declare module "adhan/lib/esm/Astronomical" {
  import Astronomical from "adhan/lib/types/Astronomical";
  export default Astronomical;
}
