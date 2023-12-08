import { SomeCompanionConfigField } from '@companion-module/base';

/**
 * Module configuration structure.
 */
export interface Config {
  // VTube Studio API IP
  host?: string;
  port?: string;
  authenticationToken?: string;
}

export const getConfigFields = (): SomeCompanionConfigField[] => {
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
};
