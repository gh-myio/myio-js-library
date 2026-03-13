import { OpenUserManagementParams, UserManagementConfig } from './types';
import { UserManagementModalView } from './UserManagementModalView';

export class UserManagementController {
  private view: UserManagementModalView;

  constructor(params: OpenUserManagementParams) {
    const config: UserManagementConfig = {
      customerId: params.customerId,
      tenantId: params.tenantId,
      customerName: params.customerName || '',
      jwtToken: params.jwtToken,
      tbBaseUrl: params.tbBaseUrl.replace(/\/$/, ''),
      currentUser: params.currentUser,
      theme: params.theme ?? 'light',
      onClose: () => { /* handled by view */ },
    };
    this.view = new UserManagementModalView(config);
  }

  show(): void {
    this.view.render();
  }
}
