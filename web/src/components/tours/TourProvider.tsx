// TourProvider — mount once inside the dashboard shell. It drives the headless
// tour runner (driver.js): auto-fires the role welcome tour on first login,
// runs page/workflow tours started from the launcher, filters steps by
// permission, protects sensitive actions, and tracks progress.
//
// The implementation lives in ../onboarding-tour; this is the v3-named entry
// point and the home of the public dispatch API.
export {
  OnboardingTour as TourProvider,
  OnboardingTour,
  dispatchStartTour,
  dispatchTourReplay,
  TOUR_ACTIVE_CHANGED_EVENT,
  type StartTourDetail,
} from "@/components/onboarding-tour";
