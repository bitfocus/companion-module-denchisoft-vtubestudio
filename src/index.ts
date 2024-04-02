import {
  DropdownChoice,
  InstanceBase,
  InstanceStatus,
  runEntrypoint,
  SomeCompanionConfigField,
} from '@companion-module/base';
import { getVariables } from './variables';
import { getUpgrades } from './upgrades';
import { ApiClient, IApiClientOptions, RestrictedRawKey } from 'vtubestudio';
import { WebSocket } from 'ws';
import { getActions } from './actions';

export interface Config {
  // VTube Studio API IP
  host?: string;
  port?: string;
  authenticationToken?: string;
}

interface Hotkey {
  description: string;
  file: string;
  hotkeyID: string;
  keyCombination: RestrictedRawKey[];
  name: string;
  onScreenButtonID: number;
  type:
    | 'MoveModel'
    | 'Unset'
    | 'TriggerAnimation'
    | 'ChangeIdleAnimation'
    | 'ToggleExpression'
    | 'RemoveAllExpressions'
    | 'ChangeBackground'
    | 'ReloadMicrophone'
    | 'ReloadTextures'
    | 'CalibrateCam'
    | 'ChangeVTSModel'
    | 'TakeScreenshot'
    | 'ScreenColorOverlay'
    | 'RemoveAllItems'
    | 'ToggleItemScene'
    | 'DownloadRandomWorkshopItem'
    | 'ExecuteItemAction'
    | 'ArtMeshColorPreset'
    | 'ToggleTracker';
}

interface Model {
  modelLoaded: boolean;
  modelName: string;
  modelID: string;
  vtsModelName: string;
  vtsModelIconName: string;
}

/**
 * Companion instance class for VTube Studio's API
 */
export class VTSInstance extends InstanceBase<Config> {
  public config: Config;
  public vts!: ApiClient;

  private availableModels: Model[];
  private availableHotkeys: Hotkey[];
  private currentModel: any;

  constructor(internal: unknown) {
    super(internal);

    this.config = {};

    this.availableModels = [];
    this.availableHotkeys = [];
    this.currentModel = undefined;
  }

  async init(config: Config): Promise<void> {
    this.config = config;

    this.updateStatus(InstanceStatus.Connecting);
    if (this.config.host && this.config.port) {
      this.connectVTS();
    }
  }

  getConfigFields(): SomeCompanionConfigField[] {
    return [
      {
        type: 'textinput',
        label: 'Host',
        id: 'host',
        width: 6,
        default: '127.0.0.1',
        required: true,
      },
      {
        type: 'textinput',
        label: 'Port',
        id: 'port',
        width: 6,
        default: '8001',
        required: true,
      },
    ];
  }

  async configUpdated(config: Config): Promise<void> {
    this.config = config;

    this.init(config);
  }

  async destroy(): Promise<void> {
    this.disconnectVTS();
  }

  initVariables() {
    const variables = getVariables();
    this.setVariableDefinitions(variables);
  }

  initActions() {
    const actions = getActions(this);
    this.setActionDefinitions(actions);
  }

  async setAuthToken(token: string) {
    this.config.authenticationToken = token;
  }

  async connectVTS() {
    if (this.vts) {
      await this.vts.disconnect();
    }

    const options: IApiClientOptions = {
      authTokenGetter: () => this.config.authenticationToken as string,
      authTokenSetter: (token) => this.setAuthToken(token),
      pluginName: 'Bitfocus Companion Connector',
      pluginDeveloper: 'Omnyist Productions',
      pluginIcon:
        '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',
      url: `ws://${this.config.host}:${this.config.port}`,
      webSocketFactory: (url) => new WebSocket(url),
    };

    this.log('info', 'VTubeStudioJS client ready.');
    const client = new ApiClient(options);
    this.vts = client;

    this.vts.on('connect', async () => {
      const stats = await client.statistics();
      this.log('info', `Connected to VTube Studio v${stats.vTubeStudioVersion}`);

      this.updateStatus(InstanceStatus.Ok);
      this.vtsListeners();

      // Initialize states.
      this.initializeStates();

      // Get initial info.
      this.getCurrentModel();
      this.getAvailableModels();
      this.getAvailableHotkeys();
    });
  }

  async disconnectVTS() {
    if (this.vts) {
      await this.vts.disconnect();
    }
  }

  async vtsListeners() {
    this.vts.on('disconnect', () => {
      this.log('warn', 'VTubeStudioJS client disconnected...');
      this.updateStatus(InstanceStatus.Disconnected);
    });

    this.vts.on('error', (error) => {
      this.log('error', JSON.stringify(error));
    });
  }

  async getCurrentModel() {
    let model = await this.vts.currentModel();
    this.currentModel = model;

    this.setVariableValues({
      current_model: this.currentModel.modelName,
    });
  }

  // Available Models
  async getAvailableModels() {
    const { availableModels } = await this.vts.availableModels();

    this.availableModels = availableModels.map((model) => {
      return { ...model };
    });

    this.updateActionsFeedbacksVariables();
  }

  sortedModelChoices(): DropdownChoice[] {
    const choices: DropdownChoice[] = [];

    this.availableModels?.forEach((model: Model) => {
      choices.push({ id: model.modelID, label: model.modelName });
    });

    choices.sort((a, b) => a.label.localeCompare(b.label));
    return choices;
  }

  // Available Hotkeys
  async getAvailableHotkeys() {
    const { availableHotkeys } = await this.vts.hotkeysInCurrentModel();

    console.log('hotkeys', availableHotkeys);

    this.availableHotkeys = availableHotkeys.map((hotkey) => {
      return { ...hotkey };
    });

    this.updateActionsFeedbacksVariables();
  }

  sortedHotkeyChoices(): DropdownChoice[] {
    const choices: DropdownChoice[] = [];

    this.availableHotkeys?.forEach((hotkey: Hotkey) => {
      choices.push({ id: hotkey.hotkeyID, label: hotkey.name });
    });

    choices.sort((a, b) => a.label.localeCompare(b.label));
    return choices;
  }

  updateActionsFeedbacksVariables() {
    this.initVariables();
    this.initActions();
  }

  initializeStates() {
    this.initVariables();
    this.initActions();
  }
}

runEntrypoint(VTSInstance, getUpgrades());
