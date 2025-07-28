export type IFV = {
  name: string;
  mu: number;
  nu: number;
};

export function calculateRIQ(ifvs: IFV[]): { name: string; riq: number }[] {
  const n = ifvs.length;
  return ifvs.map(({ mu, nu, name }) => {
    // Ensure pi is never negative
    const pi = Math.max(0, 1 - mu - nu);
    const max = Math.max(mu, nu);
    const min = Math.min(mu, nu);
    const iq = (max + pi / n) ** 2 + (n - 1) * (min / (n - 1) + pi / n) ** 2;
    const riq = mu >= nu ? iq : -iq;
    return { name, riq: parseFloat(riq.toFixed(4)) };
  });
}