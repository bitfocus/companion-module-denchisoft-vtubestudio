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
