quero implementar uma gestão de perfil de usuário
1 - uma premium modal em C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\components\premium-modals
inspirada em Settings
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\components\premium-modals\settings
para um usuário,
esse painel deve ser de nível administrador
se for superadmin NO menu > configurações (em C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\MENU, ver template.html, styles.css e controller.js) deve mostrar um novo item de MENU de gestão de usuário
E esse menu vai abrir a modal premium que vai ser 16x9 COM blur no fundo, enfim, inspirada e o mais fiel a Settings
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\components\premium-modals\settings
e vamos ter várias TABS

- Lista de usuários
- NOVO usuário

// --- // --- // --- // --- // --- // --- // --- // --- // --- // --- // --- // --- // --- // --- //

NOTAS

Existem dois tipos de SuperAdmin no projeto (src/utils/superAdminUtils.ts, RFC-0104):

---

SuperAdmin
Critério: Email do usuário termina com @myio.com.br, exceto alarme@myio.com.br e alarmes@myio.com.br.

email.endsWith('@myio.com.br')
&& !email.startsWith('alarme@')
&& !email.startsWith('alarmes@')

Detectado via GET /api/auth/user (ThingsBoard JWT).

---

SuperAdmin Holding

Critério: O atributo isUserAdmin = true (SERVER_SCOPE) no Customer entity do ThingsBoard.

GET /api/plugins/telemetry/CUSTOMER/{customerId}/values/attributes/SERVER_SCOPE
→ attr.key === 'isUserAdmin' && attr.value === true

---

Permissões resultantes

┌────────────────────┬──────────────────────────────────┬────────────────────────────────────┐
│ Tipo │ Pode modificar qualquer anotação │ Pode modificar anotações do tenant │
├────────────────────┼──────────────────────────────────┼────────────────────────────────────┤
│ SuperAdmin MYIO │ ✅ Sim │ ✅ Sim │
├────────────────────┼──────────────────────────────────┼────────────────────────────────────┤
│ SuperAdmin Holding │ — │ ✅ Sim │
├────────────────────┼──────────────────────────────────┼────────────────────────────────────┤
│ Usuário comum │ Apenas as próprias │ — │
└────────────────────┴──────────────────────────────────┴────────────────────────────────────┘

A função central é getAnnotationPermissions(customerId?) que roda os dois checks em paralelo e retorna { currentUser, isSuperAdminMyio, isSuperAdminHolding }.

// --- // --- // --- // --- // --- // --- // --- // --- // --- // --- // --- // --- // --- // --- //

veja o swagger do thingsboard para as apis e temos que filtrar e decidir quais fazem sentido usarmos

GET
/api/dashboards/all{?pageSize,page,includeCustomers,textSearch,sortProperty,sortOrder}
Get All Dashboards for current user (getAllDashboards)

GET
/api/user/dashboards{?pageSize,page,mobile,textSearch,sortProperty,sortOrder,operation,userId}
Get Dashboards (getUserDashboards)

GET
/api/groupPermission/info/{groupPermissionId}{?isUserGroup}
Get Group Permission Info (getGroupPermissionInfoById)

GET
/api/userGroup/{userGroupId}/groupPermissions
Get group permissions by User Group Id (getUserGroupPermissions)

POST
/api/userGroup/groupPermissions/info
Load User Group Permissions (loadUserGroupPermissionInfos)

POST
/api/auth/login
Login method to get user JWT token data

mail-config-template-controller
Mail Config Template Controller

GET
/api/mail/config/template
Get the list of all OAuth2 client registration templates (getClientRegistrationTemplates) Available for users with 'SYS_ADMIN' or 'TENANT_ADMIN' authority.

GET
/api/notification/settings/user
getUserNotificationSettings

POST
/api/notification/settings/user
saveUserNotificationSettings

GET
/api/oauth2/config/template
Get the list of all OAuth2 client registration templates (getClientRegistrationTemplates) Available for users with 'SYS_ADMIN' or 'TENANT_ADMIN' authority.

POST
/api/oauth2/config/template
Create or update OAuth2 client registration template (saveClientRegistrationTemplate) Available for users with 'SYS_ADMIN' authority.

DELETE
/api/oauth2/config/template/{clientRegistrationTemplateId}
Delete OAuth2 client registration template by id (deleteClientRegistrationTemplate) Available for users with 'SYS_ADMIN' authority.

custom-menu-controller
Custom Menu Controller

GET
/api/customMenu/infos{?scope,assigneeType,pageSize,page,textSearch,sortProperty,sortOrder}
Get all custom menus configured at user level (getCustomMenuInfos)

GET
/api/customMenu
Get end-user Custom Menu configuration (getCustomMenu)

auth-controller
Auth Controller

POST
/api/auth/changePassword
Change password for current User (changePassword)

POST
/api/auth/logout
Logout (logout)

GET
/api/auth/user
Get current User (getUser)

GET
/api/noauth/activate{?activateToken}
Check Activate User Token (checkActivateToken)

POST
/api/noauth/activate{?sendActivationMail}
Activate User

POST
/api/noauth/resetPassword
Reset password (resetPassword)

GET
/api/noauth/resetPassword{?resetToken}
Check password reset token (checkResetToken)

POST
/api/noauth/resetPasswordByEmail
Request reset password email (requestResetPasswordByEmail)

GET
/api/noauth/userPasswordPolicy
Get the current User password policy (getUserPasswordPolicy)

GET
/api/audit/logs/user/{userId}{?pageSize,page,textSearch,sortProperty,sortOrder,startTime,endTime,actionTypes}
Get audit logs by user id (getAuditLogsByUserId)

GET
/api/customer/{customerId}/userInfos{?pageSize,page,includeCustomers,textSearch,sortProperty,sortOrder}
Get Customer user Infos (getCustomerUserInfos)

GET
/api/customer/{customerId}/users{?pageSize,page,textSearch,sortProperty,sortOrder}
Get Customer Users (getCustomerUsers)

GET
/api/customer/users{?pageSize,page,textSearch,sortProperty,sortOrder}
Get Customer Users (getCustomerUsers)

GET
/api/entityGroup/{entityGroupId}/users{?pageSize,page,textSearch,sortProperty,sortOrder}
Get users by Entity Group Id (getUsersByEntityGroupId)

GET
/api/tenant/{tenantId}/users{?pageSize,page,textSearch,sortProperty,sortOrder}
Get Tenant Users (getTenantAdmins)

POST
/api/user{?sendActivationMail,entityGroupId,entityGroupIds}
Save Or update User (saveUser)

GET
/api/user/{userId}
Get User (getUserById)

DELETE
/api/user/{userId}
Delete User (deleteUser)

GET
/api/user/{userId}/activationLink
Get activation link (getActivationLink)

GET
/api/user/{userId}/activationLinkInfo
Get activation link info (getActivationLinkInfo)

GET
/api/user/{userId}/token
Get User Token (getUserToken)

POST
/api/user/{userId}/userCredentialsEnabled{?userCredentialsEnabled}
Enable/Disable User credentials (setUserCredentialsEnabled)

GET
/api/user/dashboards
Get information about last visited and starred dashboards (getLastVisitedDashboards)

GET
/api/user/dashboards/{dashboardId}/{action}
Report action of User over the dashboard (reportUserDashboardAction)

GET
/api/user/info/{userId}
Get User info (getUserInfoById)

GET
/api/user/mobile/session
getMobileSession

POST
/api/user/mobile/session
saveMobileSession

DELETE
/api/user/mobile/session
removeMobileSession

POST
/api/user/sendActivationMail{?email}
Send or re-send the activation email

GET
/api/user/settings
Get user settings (getUserSettings)

PUT
/api/user/settings
Update user settings (saveUserSettings)

POST
/api/user/settings
Save user settings (saveUserSettings)

DELETE
/api/user/settings/{paths}
Delete user settings (deleteUserSettings)

GET
/api/user/settings/{type}
Get user settings (getUserSettings)

PUT
/api/user/settings/{type}
Update user settings (saveUserSettings)

DELETE
/api/user/settings/{type}/{paths}
Delete user settings (deleteUserSettings)

GET
/api/user/tokenAccessEnabled
Check Token Access Enabled (isUserTokenAccessEnabled)

GET
/api/user/users{?pageSize,page,textSearch,sortProperty,sortOrder}
Get Users (getUsers)

GET
/api/userInfos/all{?pageSize,page,includeCustomers,textSearch,sortProperty,sortOrder}
Get All User Infos for current user (getAllUserInfos)

GET
/api/users{?userIds}
Get Users By Ids (getUsersByIds)

GET
/api/users/assign/{alarmId}{?pageSize,page,textSearch,sortProperty,sortOrder}
Get usersForAssign (getUsersForAssign)

GET
/api/users/info{?pageSize,page,textSearch,sortProperty,sortOrder}
Find users by query (findUsersByQuery)

user-permissions-controller
User Permissions Controller

GET
/api/permissions/allowedPermissions
Get Permissions (getAllowedPermissions)

sign-up-controller
Sign Up Controller

POST
/api/noauth/activateByEmailCode{?emailCode,pkgName,platform}
Activate and login using code from Email (activateUserByEmailCode)

GET
/api/noauth/activateEmail{?emailCode,pkgName,platform}
Activate User using code from Email (activateEmail)

GET
/api/noauth/login{?pkgName,platform}
Mobile Login redirect (mobileLogin)

POST
/api/noauth/resendEmailActivation{?email,pkgName,platform}
Resend Activation Email (resendEmailActivation)

POST
/api/noauth/signup
User Sign Up (signUp)

POST
/api/signup/acceptPrivacyPolicy
Accept privacy policy (acceptPrivacyPolicy)

POST
/api/signup/acceptTermsOfUse
Accept Terms of Use (acceptTermsOfUse)

GET
/api/signup/privacyPolicyAccepted
Check privacy policy (privacyPolicyAccepted)

GET
/api/signup/termsOfUseAccepted
Check Terms Of User (termsOfUseAccepted)
