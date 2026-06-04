export enum Role {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  ACCOUNTANT = 'ACCOUNTANT',
  WAREHOUSE = 'WAREHOUSE',
  SALES = 'SALES',
  FIELD_WORKER = 'FIELD_WORKER',
  WORKER = 'WORKER',
}

export enum Permission {
  PRODUCTS_VIEW = 'products.view',
  PRODUCTS_CREATE = 'products.create',
  PRODUCTS_UPDATE = 'products.update',
  PRODUCTS_DELETE = 'products.delete',
  PRODUCTS_VIEW_PRICE = 'products.view_price',
  PRODUCTS_UPDATE_PRICE = 'products.update_price',
  
  WAREHOUSE_VIEW = 'warehouse.view',
  WAREHOUSE_CREATE = 'warehouse.create',
  WAREHOUSE_UPDATE = 'warehouse.update',
  WAREHOUSE_DELETE = 'warehouse.delete',
  WAREHOUSE_RECEIVE = 'warehouse.receive',
  WAREHOUSE_DISPATCH = 'warehouse.dispatch',
  WAREHOUSE_ADJUST = 'warehouse.adjust',
  WAREHOUSE_TRANSFER = 'warehouse.transfer',
  WAREHOUSE_MANAGE = 'warehouse.manage',
  
  PARTNERS_VIEW = 'partners.view',
  PARTNERS_MANAGE = 'partners.manage',
  
  PRODUCT_MAPPINGS_VIEW = 'product_mappings.view',
  PRODUCT_MAPPINGS_MANAGE = 'product_mappings.manage',
  
  ORDERS_VIEW = 'orders.view',
  ORDERS_CREATE = 'orders.create',
  ORDERS_SEND = 'orders.send',
  ORDERS_ACCEPT = 'orders.accept',
  ORDERS_REJECT = 'orders.reject',
  
  DISPATCHES_VIEW = 'dispatches.view',
  DISPATCHES_CREATE = 'dispatches.create',
  DISPATCHES_SEND = 'dispatches.send',
  DISPATCHES_CANCEL = 'dispatches.cancel',
  
  GOODS_RECEIPTS_VIEW = 'goods_receipts.view',
  GOODS_RECEIPTS_ACCEPT = 'goods_receipts.accept',
  GOODS_RECEIPTS_REJECT = 'goods_receipts.reject',
  
  DEBT_VIEW = 'debt.view',
  DEBT_CREATE_PAYMENT = 'debt.create_payment',
  DEBT_CONFIRM_PAYMENT = 'debt.confirm_payment',
  DEBT_REJECT_PAYMENT = 'debt.reject_payment',

  EXPENSES_VIEW = 'expenses.view',
  EXPENSES_CREATE = 'expenses.create',
  EXPENSES_MANAGE = 'expenses.manage',
  EXPENSES_APPROVE = 'expenses.approve',
  EXPENSES_REJECT = 'expenses.reject',

  INCOME_VIEW = 'income.view',
  INCOME_CREATE = 'income.create',
  INCOME_MANAGE = 'income.manage',

  PARTNER_LEDGER_VIEW = 'partner_ledger.view',
  PARTNER_LEDGER_MANAGE = 'partner_ledger.manage',
  
  REPORTS_VIEW = 'reports.view',
  REPORTS_EXPORT = 'reports.export',
  TASKS_VIEW = 'tasks.view',
  TASKS_MANAGE = 'tasks.manage',
  TASKS_ASSIGN = 'tasks.assign',
  SETTINGS_MANAGE = 'settings.manage',
  USERS_MANAGE = 'users.manage',

  POS_VIEW = 'pos.view',
  POS_CREATE = 'pos.create',
  POS_VOID = 'pos.void',
  /** Ro‘yxat narxidan past (kompaniya chegirma limiti ichida). */
  POS_CHANGE_PRICE = 'pos.change_price',
  /** Limitdan tashqari narx / to‘liq override. */
  POS_OVERRIDE_PRICE = 'pos.override_price',
  /** Nasiya sotuv va mijoz qarziga to‘lov qabul qilish. */
  POS_CREDIT = 'pos.credit',

  FIELD_TASK_VIEW_OWN = 'field.task.view_own',
  FIELD_TASK_ACCEPT = 'field.task.accept',
  FIELD_TASK_REPORT = 'field.task.report',
  FIELD_STOCK_VIEW_OWN = 'field.stock.view_own',
  FIELD_TASK_CREATE = 'field.task.create',
  FIELD_TASK_ASSIGN = 'field.task.assign',
  FIELD_TASK_APPROVE = 'field.task.approve',
  FIELD_TASK_VIEW_ALL = 'field.task.view_all',
  FIELD_STOCK_VIEW_ALL = 'field.stock.view_all',
}
