import { hostMatchesDomain, maskUsername, normalizeWebsiteDomain, parseTotpSecret, totpCode } from './website-login.utils';

describe('website login utils', () => {
    it('normalises what users type as a website', () => {
        expect(normalizeWebsiteDomain('https://www.Portal.Acme.com/login?x=1')).toBe('portal.acme.com');
        expect(normalizeWebsiteDomain('acme.co.uk')).toBe('acme.co.uk');
        expect(normalizeWebsiteDomain('localhost')).toBeNull();
        expect(normalizeWebsiteDomain('not a site')).toBeNull();
        expect(normalizeWebsiteDomain('')).toBeNull();
    });

    it('matches the site and its subdomains only', () => {
        expect(hostMatchesDomain('acme.com', 'acme.com')).toBe(true);
        expect(hostMatchesDomain('login.acme.com', 'acme.com')).toBe(true);
        expect(hostMatchesDomain('acme.com.evil.io', 'acme.com')).toBe(false);
        expect(hostMatchesDomain('notacme.com', 'acme.com')).toBe(false);
        expect(hostMatchesDomain('acme.com', 'login.acme.com')).toBe(false);
    });

    it('computes RFC 6238 codes (SHA-1 test vectors)', () => {
        const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // "12345678901234567890"
        expect(totpCode(secret, 59_000, 30, 8)).toBe('94287082');
        expect(totpCode(secret, 1_111_111_109_000, 30, 8)).toBe('07081804');
        expect(totpCode(secret, 59_000)).toBe('287082');
    });

    it('accepts setup keys and otpauth links', () => {
        expect(parseTotpSecret('gezd gnbv gy3t qojq')).toBe('GEZDGNBVGY3TQOJQ');
        expect(parseTotpSecret('otpauth://totp/Acme:me?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=Acme')).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
        expect(parseTotpSecret('123')).toBeNull();
        expect(parseTotpSecret('GEZDGNBVGY3TQOJ1')).toBeNull();
    });

    it('masks usernames', () => {
        expect(maskUsername('petros@acme.com')).toBe('pe…@acme.com');
        expect(maskUsername('jsmith')).toBe('js…h');
    });
});
