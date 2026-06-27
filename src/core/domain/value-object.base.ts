export abstract class ValueObject<TProps> {
  public readonly props: TProps;

  constructor(props: TProps) {
    this.props = Object.freeze(props);
  }

  public equals(vo?: ValueObject<TProps>): boolean {
    if (vo === null || vo === undefined) {
      return false;
    }

    if (vo.props === undefined) {
      return false;
    }

    return JSON.stringify(this.props) === JSON.stringify(vo.props);
  }
}
