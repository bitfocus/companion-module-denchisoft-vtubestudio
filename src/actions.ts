import { CompanionActionEvent, SomeCompanionActionInputField } from '@companion-module/base';
import { VTSInstance } from './index';

export interface VTSActions {
  changeModel: VTSAction<ChangeModelCallback>;
  toggleHotkey: VTSAction<ToggleHotkeyCallback>;

  // Index signature:
  [key: string]: VTSAction<any>;
}

interface ChangeModelCallback {
  actionId: 'changeModel';
  options: Readonly<{ model: string }>;
}

interface ToggleHotkeyCallback {
  actionId: 'toggleHotkey';
  options: Readonly<{ hotkey: string }>;
}

// Force options to have a default to prevent sending undefined values
type InputFieldWithDefault = Exclude<SomeCompanionActionInputField, 'default'> & {
  default: string | number | boolean | null;
};

// Actions specific to VTube Studio.
export interface VTSAction<T> {
  name: string;
  description?: string;
  options: InputFieldWithDefault[];
  callback: (action: Readonly<Omit<CompanionActionEvent, 'options' | 'id'> & T>) => void;
  subscribe?: (action: Readonly<Omit<CompanionActionEvent, 'options' | 'id'> & T>) => void;
  unsubscribe?: (action: Readonly<Omit<CompanionActionEvent, 'options' | 'id'> & T>) => void;
}

export function getActions(instance: VTSInstance): VTSActions {
  return {
    changeModel: {
      name: 'Change Model',
      options: [
        {
          type: 'dropdown',
          label: 'Model',
          id: 'model',
          default: '0',
          choices: [{ id: '0', label: 'Select Model' }, ...(instance.sortedModelChoices() || [])],
        },
      ],
      callback: async (action) => {
        await instance.vts.modelLoad({ modelID: action.options.model });
        instance.updateActionsFeedbacksVariables();
      },
    },
    toggleHotkey: {
      name: 'Toggle Hotkey',
      options: [
        {
          type: 'dropdown',
          label: 'Hotkey',
          id: 'hotkey',
          default: '0',
          choices: [{ id: '0', label: 'Select Hotkey' }, ...(instance.sortedHotkeyChoices() || [])],
        },
      ],
      callback: async (action) => {
        await instance.vts.hotkeyTrigger({ hotkeyID: action.options.hotkey });
      },
    },
  };
}
