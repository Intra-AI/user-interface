import { z } from 'zod';
import {
  Permissions,
  PermissionTypes,
  permissionsSchema,
  agentPermissionsSchema,
  promptPermissionsSchema,
  memoryPermissionsSchema,
  runCodePermissionsSchema,
  bookmarkPermissionsSchema,
  webSearchPermissionsSchema,
  fileSearchPermissionsSchema,
  multiConvoPermissionsSchema,
  temporaryChatPermissionsSchema,
  peoplePickerPermissionsSchema,
  fileCitationsPermissionsSchema,
  mcpServersPermissionsSchema,
  fileUploadPermissionsSchema,
  helpFaqPermissionsSchema,
  parametersPermissionsSchema,
  sidePanelPermissionsSchema,
} from './permissions';

/**
 * Enum for System Defined Roles
 */
export enum SystemRoles {
  /**
   * The Admin role
   */
  ADMIN = 'ADMIN',
  /**
   * The Manager role - additional rights, more than user but less than admin
   */
  MANAGER = 'MANAGER',
  /**
   * The default user role
   */
  USER = 'USER',
}

export const roleSchema = z.object({
  name: z.string(),
  permissions: permissionsSchema,
});

export type TRole = z.infer<typeof roleSchema>;

const defaultRolesSchema = z.object({
  [SystemRoles.ADMIN]: roleSchema.extend({
    name: z.literal(SystemRoles.ADMIN),
    permissions: permissionsSchema.extend({
      [PermissionTypes.PROMPTS]: promptPermissionsSchema.extend({
        [Permissions.SHARED_GLOBAL]: z.boolean().default(true),
        [Permissions.USE]: z.boolean().default(true),
        [Permissions.CREATE]: z.boolean().default(true),
        // [Permissions.SHARE]: z.boolean().default(true),
      }),
      [PermissionTypes.BOOKMARKS]: bookmarkPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(true),
      }),
      [PermissionTypes.MEMORIES]: memoryPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(true),
        [Permissions.CREATE]: z.boolean().default(true),
        [Permissions.UPDATE]: z.boolean().default(true),
        [Permissions.READ]: z.boolean().default(true),
        [Permissions.OPT_OUT]: z.boolean().default(true),
      }),
      [PermissionTypes.AGENTS]: agentPermissionsSchema.extend({
        [Permissions.SHARED_GLOBAL]: z.boolean().default(true),
        [Permissions.USE]: z.boolean().default(true),
        [Permissions.CREATE]: z.boolean().default(true),
        // [Permissions.SHARE]: z.boolean().default(true),
      }),
      [PermissionTypes.MULTI_CONVO]: multiConvoPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(true),
      }),
      [PermissionTypes.TEMPORARY_CHAT]: temporaryChatPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(true),
      }),
      [PermissionTypes.RUN_CODE]: runCodePermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(true),
      }),
      [PermissionTypes.WEB_SEARCH]: webSearchPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(true),
      }),
      [PermissionTypes.PEOPLE_PICKER]: peoplePickerPermissionsSchema.extend({
        [Permissions.VIEW_USERS]: z.boolean().default(true),
        [Permissions.VIEW_GROUPS]: z.boolean().default(true),
        [Permissions.VIEW_ROLES]: z.boolean().default(true),
      }),
      [PermissionTypes.MARKETPLACE]: z.object({
        [Permissions.USE]: z.boolean().default(false),
      }),
      [PermissionTypes.FILE_SEARCH]: fileSearchPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(true),
      }),
      [PermissionTypes.FILE_CITATIONS]: fileCitationsPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(true),
      }),
      [PermissionTypes.MCP_SERVERS]: mcpServersPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(true),
        [Permissions.CREATE]: z.boolean().default(true),
        [Permissions.SHARE]: z.boolean().default(true),
      [PermissionTypes.FILE_UPLOAD]: fileUploadPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(true),
      }),
      [PermissionTypes.HELP_FAQ]: helpFaqPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(true),
      }),
      [PermissionTypes.PARAMETERS]: parametersPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(true),
      }),
      [PermissionTypes.SIDE_PANEL]: sidePanelPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(true),
      }),
    }),
  }),
  [SystemRoles.MANAGER]: roleSchema.extend({
    name: z.literal(SystemRoles.MANAGER),
    permissions: permissionsSchema.extend({
      [PermissionTypes.PROMPTS]: promptPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(true),
        [Permissions.CREATE]: z.boolean().default(true),
        // [Permissions.SHARE]: z.boolean().default(true),
      }),
      [PermissionTypes.BOOKMARKS]: bookmarkPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(true),
      }),
      [PermissionTypes.MEMORIES]: memoryPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(false),
        [Permissions.CREATE]: z.boolean().default(false),
        [Permissions.UPDATE]: z.boolean().default(false),
        [Permissions.READ]: z.boolean().default(false),
        [Permissions.OPT_OUT]: z.boolean().default(false),
      }),
      [PermissionTypes.AGENTS]: agentPermissionsSchema.extend({
        [Permissions.SHARED_GLOBAL]: z.boolean().default(true),
        [Permissions.USE]: z.boolean().default(true),
        [Permissions.CREATE]: z.boolean().default(true),
        // [Permissions.SHARE]: z.boolean().default(true),
      }),
      [PermissionTypes.MULTI_CONVO]: multiConvoPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(true),
      }),
      [PermissionTypes.TEMPORARY_CHAT]: temporaryChatPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(true),
      }),
      [PermissionTypes.RUN_CODE]: runCodePermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(true),
      }),
      [PermissionTypes.WEB_SEARCH]: webSearchPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(true),
      }),
      [PermissionTypes.PEOPLE_PICKER]: peoplePickerPermissionsSchema.extend({
        [Permissions.VIEW_USERS]: z.boolean().default(true),
        [Permissions.VIEW_GROUPS]: z.boolean().default(false),
        [Permissions.VIEW_ROLES]: z.boolean().default(false),
      }),
      [PermissionTypes.MARKETPLACE]: z.object({
        [Permissions.USE]: z.boolean().default(true),
      }),
      [PermissionTypes.FILE_SEARCH]: fileSearchPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(true),
      }),
      [PermissionTypes.FILE_CITATIONS]: fileCitationsPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(true),
      }),
      [PermissionTypes.FILE_UPLOAD]: fileUploadPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(false),
      }),
      [PermissionTypes.HELP_FAQ]: helpFaqPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(false),
      }),
      [PermissionTypes.PARAMETERS]: parametersPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(false),
      }),
      [PermissionTypes.SIDE_PANEL]: sidePanelPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(true),
      }),
    }),
  }),
  [SystemRoles.USER]: roleSchema.extend({
    name: z.literal(SystemRoles.USER),
    permissions: permissionsSchema.extend({
      [PermissionTypes.PROMPTS]: promptPermissionsSchema.extend({
        [Permissions.SHARED_GLOBAL]: z.boolean().default(false),
        [Permissions.USE]: z.boolean().default(true),
        [Permissions.CREATE]: z.boolean().default(true),
      }),
      [PermissionTypes.BOOKMARKS]: bookmarkPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(true),
      }),
      [PermissionTypes.MEMORIES]: memoryPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(false),
        [Permissions.CREATE]: z.boolean().default(false),
        [Permissions.UPDATE]: z.boolean().default(false),
        [Permissions.READ]: z.boolean().default(false),
        [Permissions.OPT_OUT]: z.boolean().default(false),
      }),
      [PermissionTypes.AGENTS]: agentPermissionsSchema.extend({
        [Permissions.SHARED_GLOBAL]: z.boolean().default(false),
        [Permissions.USE]: z.boolean().default(true),
        [Permissions.CREATE]: z.boolean().default(true),
      }),
      [PermissionTypes.MULTI_CONVO]: multiConvoPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(true),
      }),
      [PermissionTypes.TEMPORARY_CHAT]: temporaryChatPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(true),
      }),
      [PermissionTypes.RUN_CODE]: runCodePermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(true),
      }),
      [PermissionTypes.WEB_SEARCH]: webSearchPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(true),
      }),
      [PermissionTypes.PEOPLE_PICKER]: peoplePickerPermissionsSchema.extend({
        [Permissions.VIEW_USERS]: z.boolean().default(false),
        [Permissions.VIEW_GROUPS]: z.boolean().default(false),
        [Permissions.VIEW_ROLES]: z.boolean().default(false),
      }),
      [PermissionTypes.MARKETPLACE]: z.object({
        [Permissions.USE]: z.boolean().default(false),
      }),
      [PermissionTypes.FILE_SEARCH]: fileSearchPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(true),
      }),
      [PermissionTypes.FILE_CITATIONS]: fileCitationsPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(true),
      }),
      [PermissionTypes.FILE_UPLOAD]: fileUploadPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(false),
      }),
      [PermissionTypes.HELP_FAQ]: helpFaqPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(false),
      }),
      [PermissionTypes.PARAMETERS]: parametersPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(false),
      }),
      [PermissionTypes.SIDE_PANEL]: sidePanelPermissionsSchema.extend({
        [Permissions.USE]: z.boolean().default(false),
      }),
    }),
  }),
});

export const roleDefaults = defaultRolesSchema.parse({
  [SystemRoles.ADMIN]: {
    name: SystemRoles.ADMIN,
    permissions: {
      [PermissionTypes.PROMPTS]: {
        [Permissions.SHARED_GLOBAL]: true,
        [Permissions.USE]: true,
        [Permissions.CREATE]: true,
      },
      [PermissionTypes.BOOKMARKS]: {
        [Permissions.USE]: true,
      },
      [PermissionTypes.MEMORIES]: {
        [Permissions.USE]: true,
        [Permissions.CREATE]: true,
        [Permissions.UPDATE]: true,
        [Permissions.READ]: true,
        [Permissions.OPT_OUT]: true,
      },
      [PermissionTypes.AGENTS]: {
        [Permissions.SHARED_GLOBAL]: true,
        [Permissions.USE]: true,
        [Permissions.CREATE]: true,
      },
      [PermissionTypes.MULTI_CONVO]: {
        [Permissions.USE]: true,
      },
      [PermissionTypes.TEMPORARY_CHAT]: {
        [Permissions.USE]: true,
      },
      [PermissionTypes.RUN_CODE]: {
        [Permissions.USE]: true,
      },
      [PermissionTypes.WEB_SEARCH]: {
        [Permissions.USE]: true,
      },
      [PermissionTypes.PEOPLE_PICKER]: {
        [Permissions.VIEW_USERS]: true,
        [Permissions.VIEW_GROUPS]: true,
        [Permissions.VIEW_ROLES]: true,
      },
      [PermissionTypes.MARKETPLACE]: {
        [Permissions.USE]: true,
      },
      [PermissionTypes.FILE_SEARCH]: {
        [Permissions.USE]: true,
      },
      [PermissionTypes.FILE_CITATIONS]: {
        [Permissions.USE]: true,
      },
      [PermissionTypes.MCP_SERVERS]: {
        [Permissions.USE]: true,
        [Permissions.CREATE]: true,
        [Permissions.SHARE]: true,
      [PermissionTypes.FILE_UPLOAD]: {
        [Permissions.USE]: true,
      },
      [PermissionTypes.HELP_FAQ]: {
        [Permissions.USE]: true,
      },
      [PermissionTypes.PARAMETERS]: {
        [Permissions.USE]: true,
      },
      [PermissionTypes.SIDE_PANEL]: {
        [Permissions.USE]: true,
      },
    },
  },
  [SystemRoles.MANAGER]: {
    name: SystemRoles.MANAGER,
    permissions: {
      [PermissionTypes.PROMPTS]: {},
      [PermissionTypes.BOOKMARKS]: {},
      [PermissionTypes.MEMORIES]: {},
      [PermissionTypes.AGENTS]: {},
      [PermissionTypes.MULTI_CONVO]: {},
      [PermissionTypes.TEMPORARY_CHAT]: {},
      [PermissionTypes.RUN_CODE]: {},
      [PermissionTypes.WEB_SEARCH]: {},
      [PermissionTypes.PEOPLE_PICKER]: {},
      [PermissionTypes.MARKETPLACE]: {},
      [PermissionTypes.FILE_SEARCH]: {},
      [PermissionTypes.FILE_CITATIONS]: {},
      [PermissionTypes.FILE_UPLOAD]: {},
      [PermissionTypes.HELP_FAQ]: {},
      [PermissionTypes.PARAMETERS]: {},
      [PermissionTypes.SIDE_PANEL]: {},
    },
  },
  [SystemRoles.USER]: {
    name: SystemRoles.USER,
    permissions: {
      [PermissionTypes.PROMPTS]: {},
      [PermissionTypes.BOOKMARKS]: {},
      [PermissionTypes.MEMORIES]: {},
      [PermissionTypes.AGENTS]: {},
      [PermissionTypes.MULTI_CONVO]: {},
      [PermissionTypes.TEMPORARY_CHAT]: {},
      [PermissionTypes.RUN_CODE]: {},
      [PermissionTypes.WEB_SEARCH]: {},
      [PermissionTypes.PEOPLE_PICKER]: {},
      [PermissionTypes.MARKETPLACE]: {},
      [PermissionTypes.FILE_SEARCH]: {},
      [PermissionTypes.FILE_CITATIONS]: {},
      [PermissionTypes.MCP_SERVERS]: {},
      [PermissionTypes.FILE_UPLOAD]: {
        [Permissions.USE]: false,
      },
      [PermissionTypes.HELP_FAQ]: {
        [Permissions.USE]: false,
      },
      [PermissionTypes.PARAMETERS]: {
        [Permissions.USE]: false,
      },
      [PermissionTypes.SIDE_PANEL]: {
        [Permissions.USE]: false,
      },
    },
  },
});
