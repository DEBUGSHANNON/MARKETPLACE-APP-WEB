import React, { useEffect, useState } from 'react';
import { MapPin, X } from 'lucide-react';
import { CampusZone } from '../types/marketplace';
import { UTM_CAMPUS_ZONES } from '../data/utmCatalog';

interface UtmHandoverModalProps {
  open: boolean;
  mode: 'seller' | 'buyer';
  listingTitle: string;
  onClose: () => void;
  onSubmit: (payload: {
    location: string;
    date: string;
    time: string;
    note: string;
    lat: number;
    lng: number;
  }) => Promise<void>;
}

function todayMalaysia(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const val = (type: string) => parts.find((p) => p.type === type)?.value || '01';
  return `${val('year')}-${val('month')}-${val('day')}`;
}

export const UtmHandoverModal: React.FC<UtmHandoverModalProps> = ({
  open,
  mode,
  listingTitle,
  onClose,
  onSubmit,
}) => {
  const [selectedZone, setSelectedZone] = useState<CampusZone>(UTM_CAMPUS_ZONES[0]);
  const [location, setLocation] = useState(UTM_CAMPUS_ZONES[0].name);
  const [pinX, setPinX] = useState(UTM_CAMPUS_ZONES[0].mapX);
  const [pinY, setPinY] = useState(UTM_CAMPUS_ZONES[0].mapY);
  const [lat, setLat] = useState(UTM_CAMPUS_ZONES[0].lat);
  const [lng, setLng] = useState(UTM_CAMPUS_ZONES[0].lng);
  const [date, setDate] = useState(todayMalaysia());
  const [hour, setHour] = useState('14');
  const [minute, setMinute] = useState('30');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      const z = UTM_CAMPUS_ZONES[0];
      setSelectedZone(z);
      setLocation(z.name);
      setPinX(z.mapX);
      setPinY(z.mapY);
      setLat(z.lat);
      setLng(z.lng);
      setDate(todayMalaysia());
      setHour('14');
      setMinute('30');
      setNote('');
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const pickZone = (zone: CampusZone) => {
    setSelectedZone(zone);
    setLocation(zone.name);
    setPinX(zone.mapX);
    setPinY(zone.mapY);
    setLat(zone.lat);
    setLng(zone.lng);
  };

  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(5, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100));
    setPinX(xPct);
    setPinY(yPct);
    // Interpolate approximate UTM Skudai coordinates
    const calcLat = 1.567 - (yPct / 100) * 0.016;
    const calcLng = 103.628 + (xPct / 100) * 0.022;
    setLat(Number(calcLat.toFixed(5)));
    setLng(Number(calcLng.toFixed(5)));
    setLocation(`UTM Campus Pin (${calcLat.toFixed(4)}, ${calcLng.toFixed(4)})`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = location.trim();
    if (!trimmed || trimmed.length > 150) {
      setError('Please enter a valid meeting location (max 150 characters).');
      return;
    }
    if (date < todayMalaysia()) {
      setError('Please choose today or a future date.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        location: trimmed,
        date,
        time: `${hour}:${minute}`,
        note: note.trim().slice(0, 300),
        lat,
        lng,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save handover proposal.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="handover-modal-title"
      className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#F3F3EE] border border-black/10 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 md:p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-xs font-semibold text-[#4A5D50]">
              {listingTitle}
            </p>
            <h2
              id="handover-modal-title"
              className="text-2xl font-extrabold tracking-tight text-[#112419] mt-1"
            >
              {mode === 'buyer'
                ? 'Suggest Handover Changes'
                : 'Arrange UTM Campus Handover'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close handover modal"
            className="p-2 rounded-lg hover:bg-black/5 text-[#4A5D50] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Quick Campus Landmark Buttons */}
          <div>
            <p className="text-xs font-semibold text-[#112419] mb-2">
              Tap a Public UTM Landmark or Click Directly on the Campus Map
            </p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {UTM_CAMPUS_ZONES.map((z) => {
                const active = selectedZone.id === z.id && location === z.name;
                return (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => pickZone(z)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#0A462C] text-white'
                        : 'bg-white border border-black/10 text-[#4A5D50] hover:text-[#112419]'
                    }`}
                  >
                    {z.shortName}
                  </button>
                );
              })}
            </div>

            {/* Interactive SVG UTM Campus Map */}
            <div className="rounded-xl overflow-hidden border border-black/10 bg-[#EAECE4] relative">
              <svg
                viewBox="0 0 100 100"
                onClick={handleMapClick}
                className="w-full h-52 cursor-crosshair block"
                role="img"
                aria-label="Interactive UTM Skudai campus map"
              >
                {/* Lingkaran Ilmu ring road & Tasik Ilmu */}
                <ellipse
                  cx="48"
                  cy="44"
                  rx="24"
                  ry="20"
                  fill="none"
                  stroke="#0A462C"
                  strokeOpacity="0.16"
                  strokeWidth="1.4"
                />
                <path
                  d="M8,76 Q32,58 48,44 T90,26"
                  fill="none"
                  stroke="#0A462C"
                  strokeOpacity="0.12"
                  strokeWidth="1.2"
                  strokeDasharray="2.5 2.5"
                />
                <ellipse
                  cx="33"
                  cy="52"
                  rx="6"
                  ry="4"
                  fill="#B7D2C1"
                  fillOpacity="0.65"
                />

                {/* Landmark pins */}
                {UTM_CAMPUS_ZONES.map((z) => (
                  <g
                    key={z.id}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      pickZone(z);
                    }}
                    className="cursor-pointer"
                  >
                    <circle
                      cx={z.mapX}
                      cy={z.mapY}
                      r="2.4"
                      fill="#FFFFFF"
                      stroke="#0A462C"
                      strokeWidth="1"
                    />
                    <text
                      x={z.mapX}
                      y={z.mapY - 3.8}
                      textAnchor="middle"
                      fontSize="3.1"
                      fontWeight="600"
                      fill="#233B2C"
                    >
                      {z.shortName}
                    </text>
                  </g>
                ))}

                {/* Active selected pin */}
                <circle
                  cx={pinX}
                  cy={pinY}
                  r="6"
                  fill="#0A462C"
                  fillOpacity="0.18"
                />
                <circle
                  cx={pinX}
                  cy={pinY}
                  r="2.8"
                  fill="#0A462C"
                  stroke="#FFFFFF"
                  strokeWidth="1"
                />
              </svg>

              <div className="px-3 py-2 bg-white/95 border-t border-black/10 flex items-center justify-between text-[11px] text-[#4A5D50]">
                <span className="flex items-center gap-1 font-medium text-[#112419]">
                  <MapPin className="w-3.5 h-3.5 text-[#0A462C]" />
                  {location}
                </span>
                <span className="font-mono-tabular">
                  {lat.toFixed(4)}, {lng.toFixed(4)}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#112419] mb-1.5">
              Meeting Spot Label
            </label>
            <input
              type="text"
              maxLength={150}
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-black/10 text-sm text-[#112419]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#112419] mb-1.5">
                Handover Date
              </label>
              <input
                type="date"
                min={todayMalaysia()}
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-black/10 text-sm text-[#112419]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#112419] mb-1.5">
                Handover Time
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={hour}
                  onChange={(e) => setHour(e.target.value)}
                  aria-label="Hour"
                  className="flex-1 px-3 py-2.5 rounded-xl bg-white border border-black/10 text-sm text-[#112419]"
                >
                  {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(
                    (h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ),
                  )}
                </select>
                <span className="font-bold text-[#4A5D50]">:</span>
                <select
                  value={minute}
                  onChange={(e) => setMinute(e.target.value)}
                  aria-label="Minute"
                  className="flex-1 px-3 py-2.5 rounded-xl bg-white border border-black/10 text-sm text-[#112419]"
                >
                  {Array.from({ length: 12 }, (_, i) =>
                    String(i * 5).padStart(2, '0'),
                  ).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#112419] mb-1.5">
              Handover Notes (Optional)
            </label>
            <textarea
              rows={2}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Waiting near PSZ main glass entrance."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-black/10 text-sm text-[#112419]"
            />
          </div>

          {error && (
            <p className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-black/15 text-sm font-semibold text-[#112419] hover:bg-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-[#0A462C] text-white text-sm font-semibold hover:bg-[#0E5D3B] disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Sending...' : 'Send Handover Proposal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
