import React, { useEffect, useState } from 'react';
import { User, updateProfile } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ShieldCheck } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { isUtmStudentEmail, UTM_COLLEGES } from '../data/utmCatalog';

interface ProfileViewProps {
  user: User | null;
  onSignIn: () => void;
  onToast: (msg: string) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  onSignIn,
  onToast,
}) => {
  const [displayName, setDisplayName] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [college, setCollege] = useState('');
  const [dormAddress, setDormAddress] = useState('');
  const [hasExistingDoc, setHasExistingDoc] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const loadProfile = async () => {
      setLoading(true);
      const path = `users/${user.uid}`;
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data();
          setHasExistingDoc(true);
          setDisplayName(
            data.displayName || user.displayName || user.email?.split('@')[0] || '',
          );
          const rawPhone = String(data.phone || '').replace(/[\s-]/g, '');
          setPhoneDigits(
            rawPhone.startsWith('+60')
              ? rawPhone.slice(3)
              : rawPhone.startsWith('0')
                ? rawPhone.slice(1)
                : rawPhone,
          );
          setCollege(data.college || '');
          setDormAddress(data.dormAddress || '');
        } else {
          setHasExistingDoc(false);
          setDisplayName(user.displayName || user.email?.split('@')[0] || '');
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-5 md:px-10 py-16 text-center">
        <div className="bg-white border border-black/10 rounded-2xl p-10">
          <h1 className="text-3xl font-extrabold text-[#112419] mb-3">
            Sign in to view your student profile
          </h1>
          <p className="text-sm text-[#4A5D50] mb-6">
            Save your preferred residential college and contact details privately using your <span className="font-semibold text-[#0A462C]">@graduate.utm.my</span> student account.
          </p>
          <button
            type="button"
            onClick={onSignIn}
            className="px-5 py-3 rounded-xl bg-[#0A462C] text-white text-sm font-semibold cursor-pointer"
          >
            Sign In with UTM Google (@graduate.utm.my)
          </button>
        </div>
      </div>
    );
  }

  const utmVerified = isUtmStudentEmail(user.email);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = displayName.trim().slice(0, 60);
    if (!cleanName) {
      onToast('Please enter a display name.');
      return;
    }

    const digits = phoneDigits.replace(/\D/g, '');
    if (digits && !/^1\d{8,9}$/.test(digits)) {
      onToast('Enter a valid Malaysian mobile number without the leading 0.');
      return;
    }
    const formattedPhone = digits ? `+60${digits}` : '';

    setSaving(true);
    const path = `users/${user.uid}`;
    try {
      await updateProfile(user, { displayName: cleanName });

      if (hasExistingDoc) {
        await setDoc(
          doc(db, 'users', user.uid),
          {
            displayName: cleanName,
            phone: formattedPhone,
            college: college.slice(0, 80),
            dormAddress: dormAddress.trim().slice(0, 200),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      } else {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          displayName: cleanName,
          email: user.email || '',
          phone: formattedPhone,
          college: college.slice(0, 80),
          dormAddress: dormAddress.trim().slice(0, 200),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setHasExistingDoc(true);
      }
      onToast('Student profile saved.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-10 py-10 md:py-14">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#659A73] mb-2">
          Your Campus Identity
        </p>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#112419]">
          Student{' '}
          <span className="font-display-serif italic font-normal text-utm-gradient">
            Profile
          </span>
        </h1>
      </div>

      <div className="glass-surface border border-[#0A462C]/12 rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="pb-6 mb-6 border-b border-black/10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#112419]">
              {displayName || 'UTM Student'}
            </h2>
            <p className="text-xs text-[#4A5D50] mt-0.5">{user.email}</p>
          </div>
          {utmVerified && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0A462C]">
              <ShieldCheck className="w-4 h-4" />
              <span>Verified UTM Email</span>
            </span>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-[#4A5D50] py-6">Loading profile...</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[#112419] mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                maxLength={60}
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F3F3EE] border border-black/10 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#112419] mb-1.5">
                Malaysian Phone (Optional, private)
              </label>
              <div className="flex items-stretch rounded-xl overflow-hidden border border-black/10 bg-[#F3F3EE]">
                <span className="px-3.5 flex items-center text-xs font-bold text-[#0A462C] bg-[#E3ECE0] border-r border-black/10">
                  +60
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={12}
                  value={phoneDigits}
                  onChange={(e) => setPhoneDigits(e.target.value)}
                  placeholder="12 345 6789"
                  className="flex-1 px-3.5 py-2.5 bg-transparent text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#112419] mb-1.5">
                UTM Residential College
              </label>
              <select
                value={college}
                onChange={(e) => setCollege(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F3F3EE] border border-black/10 text-sm"
              >
                <option value="">Select your residential college</option>
                {UTM_COLLEGES.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#112419] mb-1.5">
                General Block or Area Note (Optional)
              </label>
              <textarea
                rows={2}
                maxLength={200}
                value={dormAddress}
                onChange={(e) => setDormAddress(e.target.value)}
                placeholder="e.g. Near KTR Courtyard (avoid exact room numbers)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F3F3EE] border border-black/10 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-3 rounded-xl bg-[#0A462C] text-white text-sm font-semibold hover:bg-[#0E5D3B] disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
