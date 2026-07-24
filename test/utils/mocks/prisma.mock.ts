export class PrismaModelMock {
  public readonly findFirst = jest.fn();
  public readonly findUnique = jest.fn();
  public readonly findMany = jest.fn();
  public readonly create = jest.fn();
  public readonly update = jest.fn();
  public readonly delete = jest.fn();
  public readonly deleteMany = jest.fn();
  public readonly count = jest.fn();
  public readonly upsert = jest.fn();
}

export class PrismaTransactionMock {
  public readonly user = new PrismaModelMock();
  public readonly institution = new PrismaModelMock();
  public readonly role = new PrismaModelMock();
  public readonly rolePermission = new PrismaModelMock();
  public readonly permission = new PrismaModelMock();
  public readonly superAdmin = new PrismaModelMock();
  public readonly userRole = new PrismaModelMock();

  public constructor() {
    this.institution.create.mockResolvedValue({ id: 'tx-inst-id' });
    this.role.create.mockResolvedValue({ id: 'tx-role-id' });
    this.user.create.mockResolvedValue({ id: 'tx-user-id' });
    this.rolePermission.create.mockResolvedValue({ id: 'tx-rp-id' });
    this.permission.findMany.mockResolvedValue([]);
    this.rolePermission.findMany.mockResolvedValue([]);
    this.rolePermission.deleteMany.mockResolvedValue(undefined);
  }
}

export class PrismaServiceMock {
  public readonly user = new PrismaModelMock();
  public readonly institution = new PrismaModelMock();
  public readonly role = new PrismaModelMock();
  public readonly rolePermission = new PrismaModelMock();
  public readonly permission = new PrismaModelMock();
  public readonly superAdmin = new PrismaModelMock();
  public readonly userRole = new PrismaModelMock();
  public readonly $transaction = jest.fn();

  public constructor() {
    this.$transaction.mockImplementation(
      async (
        cb: (tx: PrismaTransactionMock) => Promise<unknown>,
      ): Promise<unknown> => {
        const tx = new PrismaTransactionMock();
        return cb(tx);
      },
    );
  }
}
