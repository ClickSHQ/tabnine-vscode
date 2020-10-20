import { TabNine } from "./TabNine";
import * as vscode from "vscode";

export const ON_BOARDING_CAPABILITY = "vscode.onboarding";
export const NOTIFICATIONS_CAPABILITY = "vscode.user-notifications";
export const VALIDATOR_CAPABILITY = "vscode.validator";
export const VALIDATOR_MODE_A_CAPABILITY_KEY = "vscode.validator.mode.A";
export const VALIDATOR_MODE_B_CAPABILITY_KEY = "vscode.validator.mode.B";
export const VALIDATOR_BACKGROUND_CAPABILITY = "vscode.validator.background";
export const VALIDATOR_PASTE_CAPABILITY = "vscode.validator.paste";

export function getCapabilitiesOnFocus(
  tabNine: TabNine
): Promise<{ isCapability: (string) => boolean }> {
  return new Promise((resolve) => {
    if (vscode.window.state.focused) {
      console.log("resolved immediately");
      resolveCapabilities(resolve, tabNine);
    } else {
      let disposable = vscode.window.onDidChangeWindowState(({ focused }) => {
        disposable.dispose();
        console.log(`resolved on focus ${focused}`);
        resolveCapabilities(resolve, tabNine);
      });
    }
  });
}
async function resolveCapabilities(resolve, tabNine: TabNine) {
  let { enabled_features } = await tabNine.getCapabilities();
  resolve({
    isCapability(capability) {
      return enabled_features.includes(capability);
    },
  });
}
