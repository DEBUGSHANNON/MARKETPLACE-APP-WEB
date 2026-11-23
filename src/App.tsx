import React, { useEffect, useMemo, useState } from 'react';
import {
  User,
  onIdTokenChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  Calendar,
  Compass,
  Grid,
  Heart,
  Loader2,
  MessageSquare,
  RefreshCw,
  WifiOff,
} from 'lucide-react';
import {
  auth,
  checkEmulatorReachable,
  db,
  getFriendlyFirebaseError,
  googleProvider,
  handleFirestoreError,
  IS_EMULATOR_MODE,
  isNetworkOrUnavailableError,
  isPermissionDeniedError,
  OperationType,
  switchEmulatorRole,
} from './lib/firebase';
import {
  AppView,
  Listing,
  ListingCategory,
  ListingCondition,
  ListingType,
  Reservation,
  WishlistItem,
} from './types/marketplace';
import { isUtmStudentEmail, SHOWCASE_LISTINGS } from './data/utmCatalog';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Navbar } from './components/Navbar';
import { OrbitSphere } from './components/OrbitSphere';
import { ObjectDetailView } from './components/ObjectDetailView';
import { CatalogView } from './components/CatalogView';
import { CreateListingModal } from './components/CreateListingModal';
import { ReservationsView } from './components/ReservationsView';
import { UtmHandoverModal } from './components/UtmHandoverModal';
import { ChatModal } from './components/ChatModal';
import { MyListingsView } from './components/MyListingsView';
import { ProfileView } from './components/ProfileView';
import { SphereObjectModal, OriginRect } from './components/SphereObjectModal';
import { AmbientOrbitBackdrop } from './components/AmbientOrbitBackdrop';
import { WishlistView } from './components/WishlistView';
import { MyMessagesView } from './components/MyMessagesView';

function MarketplaceContent() {
  const [user, setUser] = useState<User | null>(null);
  const [authRevision, setAuthRevision] = useState(0);
  const [authReady, setAuthReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [emulatorOnline, setEmulatorOnline] = useState<boolean | null>(null);

  const [currentView, setCurrentView] = useState<AppView>('orbit');
  const [previousView, setPreviousView] = useState<'orbit' | 'catalog'>('orbit');
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [spherePopup, setSpherePopup] = useState<{
    listing: Listing;
    originRect: OriginRect | null;
  } | null>(null);

  const [liveListings, setLiveListings] = useState<Listing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingsSlow, setListingsSlow] = useState(false);
  const [listingsError, setListingsError] = useState<string | null>(null);
  const [listingsRetryTick, setListingsRetryTick] = useState(0);

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reservationsLoading, setReservationsLoading] = useState(false);
  const [reservationsSlow, setReservationsSlow] = useState(false);
  const [reservationsError, setReservationsError] = useState<string | null>(null);
  const [reservationsRetryTick, setReservationsRetryTick] = useState(0);

  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [wishlistError, setWishlistError] = useState<string | null>(null);
  const [wishlistRetryTick, setWishlistRetryTick] = useState(0);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<Listing | null>(null);

  const [handoverTarget, setHandoverTarget] = useState<{
    reservation: Reservation;
    mode: 'seller' | 'buyer';
  } | null>(null);
  const [chatTarget, setChatTarget] = useState<Reservation | null>(null);
  const [justReservedChat, setJustReservedChat] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3400);
  };

  // Monitor browser online/offline transitions cleanly
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setListingsRetryTick((t) => t + 1);
      setReservationsRetryTick((t) => t + 1);
      setWishlistRetryTick((t) => t + 1);
      showToast('Back online — syncing with UTM campus database.');
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast('You are offline. Reconnect to reserve, chat, or publish.');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auth & ID token listener (enforces @graduate.utm.my UTM student accounts only)
  useEffect(() => {
    const unsub = onIdTokenChanged(auth, (nextUser) => {
      if (nextUser && !isUtmStudentEmail(nextUser.email)) {
        setUser(null);
        setAuthRevision((r) => r + 1);
        setAuthReady(true);
        void signOut(auth);
        showToast('Only UTM student accounts (@graduate.utm.my) can log in.');
        return;
      }
      setUser(nextUser);
      setAuthRevision((r) => r + 1);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Check if local Firebase Emulator Suite is reachable when in Emulator mode
  useEffect(() => {
    if (!IS_EMULATOR_MODE) return;
    let cancelled = false;
    void checkEmulatorReachable().then((ok) => {
      if (!cancelled) setEmulatorOnline(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Public listings listener with slow-latency awareness & graceful retry
  useEffect(() => {
    setListingsLoading(true);
    setListingsSlow(false);
    setListingsError(null);

    const slowTimer = window.setTimeout(() => {
      setListingsSlow(true);
    }, 3500);

    const q = query(collection(db, 'listings'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        window.clearTimeout(slowTimer);
        const docs = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Listing, 'id'>),
        }));
        setLiveListings(docs);
        setListingsLoading(false);
        setListingsSlow(false);
        setListingsError(null);
      },
      (error) => {
        window.clearTimeout(slowTimer);
        setListingsLoading(false);
        setListingsSlow(false);
        const code = (error as { code?: string })?.code || '';
        const msg = error instanceof Error ? error.message : String(error);
        if (
          IS_EMULATOR_MODE &&
          (code === 'unavailable' ||
            msg.includes('offline') ||
            msg.includes('Failed to fetch'))
        ) {
          setEmulatorOnline(false);
          setListingsError(
            'Cannot reach local Firebase Emulator on 127.0.0.1:8080.',
          );
          return;
        }
        if (isNetworkOrUnavailableError(error)) {
          setListingsError(getFriendlyFirebaseError(error));
          return;
        }
        setListingsError(getFriendlyFirebaseError(error));
        if (isPermissionDeniedError(error)) {
          handleFirestoreError(error, OperationType.LIST, 'listings');
        }
      },
    );
    return () => {
      window.clearTimeout(slowTimer);
      unsub();
    };
  }, [listingsRetryTick]);

  // Authenticated user's reservations listener (buyer + seller merged)
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) {
      setReservations([]);
      setReservationsLoading(false);
      setReservationsSlow(false);
      setReservationsError(null);
      return;
    }

    setReservationsLoading(true);
    setReservationsSlow(false);
    setReservationsError(null);

    const slowTimer = window.setTimeout(() => {
      setReservationsSlow(true);
    }, 3500);

    let buyerLoaded = false;
    let sellerLoaded = false;
    let buyerDocs: Reservation[] = [];
    let sellerDocs: Reservation[] = [];

    const mergeAndSet = () => {
      const map = new Map<string, Reservation>();
      [...buyerDocs, ...sellerDocs].forEach((r) => map.set(r.id, r));
      setReservations(Array.from(map.values()));
      if (buyerLoaded && sellerLoaded) {
        window.clearTimeout(slowTimer);
        setReservationsLoading(false);
        setReservationsSlow(false);
        setReservationsError(null);
      }
    };

    const buyerQ = query(
      collection(db, 'reservations'),
      where('buyerId', '==', user.uid),
    );
    const sellerQ = query(
      collection(db, 'reservations'),
      where('sellerId', '==', user.uid),
    );

    const handleSubError = (error: unknown) => {
      if (!auth.currentUser || auth.currentUser.uid !== user.uid) return;
      window.clearTimeout(slowTimer);
      setReservationsLoading(false);
      setReservationsSlow(false);
      const code = (error as { code?: string })?.code || '';
      if (IS_EMULATOR_MODE && code === 'unavailable') {
        setEmulatorOnline(false);
        setReservationsError(
          'Cannot reach local Firebase Emulator on 127.0.0.1:8080.',
        );
        return;
      }
      if (isNetworkOrUnavailableError(error)) {
        setReservationsError(getFriendlyFirebaseError(error));
        return;
      }
      setReservationsError(getFriendlyFirebaseError(error));
      if (isPermissionDeniedError(error)) {
        handleFirestoreError(error, OperationType.LIST, 'reservations');
      }
    };

    const unsubBuyer = onSnapshot(
      buyerQ,
      (snap) => {
        buyerLoaded = true;
        buyerDocs = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Reservation, 'id'>),
        }));
        mergeAndSet();
      },
      handleSubError,
    );

    const unsubSeller = onSnapshot(
      sellerQ,
      (snap) => {
        sellerLoaded = true;
        sellerDocs = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Reservation, 'id'>),
        }));
        mergeAndSet();
      },
      handleSubError,
    );

    return () => {
      window.clearTimeout(slowTimer);
      unsubBuyer();
      unsubSeller();
    };
  }, [authReady, user, authRevision, reservationsRetryTick]);

  // Authenticated user's wishlist listener
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) {
      setWishlistItems([]);
      setWishlistLoading(false);
      setWishlistError(null);
      return;
    }

    setWishlistLoading(true);
    setWishlistError(null);
    const path = `users/${user.uid}/wishlist`;
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setWishlistItems(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<WishlistItem, 'id'>),
          })),
        );
        setWishlistLoading(false);
        setWishlistError(null);
      },
      (error) => {
        if (!auth.currentUser || auth.currentUser.uid !== user.uid) return;
        setWishlistLoading(false);
        const code = (error as { code?: string })?.code || '';
        if (IS_EMULATOR_MODE && code === 'unavailable') {
          setEmulatorOnline(false);
          setWishlistError(
            'Cannot reach local Firebase Emulator on 127.0.0.1:8080.',
          );
          return;
        }
        if (isNetworkOrUnavailableError(error)) {
          setWishlistError(getFriendlyFirebaseError(error));
          return;
        }
        setWishlistError(getFriendlyFirebaseError(error));
        if (isPermissionDeniedError(error)) {
          handleFirestoreError(error, OperationType.LIST, path);
        }
      },
    );

    return () => unsub();
  }, [authReady, user, authRevision, wishlistRetryTick]);

  const wishlistIds = useMemo(
    () => new Set(wishlistItems.map((w) => w.listingId)),
    [wishlistItems],
  );

  // Combine live Firestore listings with curated UTM showcase items when needed
  const allListings = useMemo(() => {
    if (liveListings.length >= 6) {
      return liveListings;
    }
    const existingIds = new Set(liveListings.map((l) => l.id));
    const fillers = SHOWCASE_LISTINGS.filter((s) => !existingIds.has(s.id));
    return [...liveListings, ...fillers];
  }, [liveListings]);

  const selectedListing = useMemo(
    () => allListings.find((l) => l.id === selectedListingId) || null,
    [allListings, selectedListingId],
  );

  const handleSwitchEmulator = async (role: 'seller' | 'buyer') => {
    try {
      setChatTarget(null);
      setHandoverTarget(null);
      setCreateModalOpen(false);
      const switched = await switchEmulatorRole(role);
      setEmulatorOnline(true);
      setAuthRevision((r) => r + 1);
      showToast(`Emulator switched to ${switched.displayName || role}.`);
    } catch (err) {
      setEmulatorOnline(false);
      showToast(
        err instanceof Error
          ? err.message
          : 'Make sure Firebase Emulators are running on ports 9099 and 8080.',
      );
    }
  };

  const handleSignIn = async () => {
    if (signingIn) return;
    if (!isOnline && !IS_EMULATOR_MODE) {
      showToast('You appear to be offline. Reconnect to sign in.');
      return;
    }
    if (IS_EMULATOR_MODE) {
      const nextRole =
        user?.email === 'buyer.utm@graduate.utm.my' ? 'seller' : 'buyer';
      setSigningIn(true);
      try {
        await handleSwitchEmulator(nextRole);
      } finally {
        setSigningIn(false);
      }
      return;
    }
    setSigningIn(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (!isUtmStudentEmail(cred.user.email)) {
        await signOut(auth);
        showToast(
          'Access restricted: please sign in using your @graduate.utm.my student Google account.',
        );
        return;
      }
      showToast('Signed in to CampusTrade UTM.');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      if (!raw.includes('popup-closed-by-user')) {
        showToast(getFriendlyFirebaseError(err, 'Sign-in could not be completed.'));
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleSeedListings = async () => {
    if (!user) {
      await handleSignIn();
      return;
    }
    if (!isOnline && !IS_EMULATOR_MODE) {
      showToast('You are offline. Reconnect to publish sample listings.');
      return;
    }
    const sellerName = (
      user.displayName?.trim() ||
      user.email?.split('@')[0] ||
      'UTM Student'
    ).slice(0, 60);

    try {
      await Promise.all(
        SHOWCASE_LISTINGS.map((item) =>
          addDoc(collection(db, 'listings'), {
            title: item.title.slice(0, 100),
            description: item.description.slice(0, 2000),
            price: item.price,
            category: item.category,
            type: item.type,
            condition: item.condition,
            campusZone: item.campusZone.slice(0, 80),
            imageUrl: item.imageUrl,
            sellerId: user.uid,
            sellerName,
            sellerVerifiedUtm: isUtmStudentEmail(user.email),
            status: 'available',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }),
        ),
      );
      showToast('Published 6 UTM listings to Firebase!');
    } catch (error) {
      if (isNetworkOrUnavailableError(error)) {
        showToast(getFriendlyFirebaseError(error));
        return;
      }
      handleFirestoreError(error, OperationType.CREATE, 'listings');
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    showToast('Signed out.');
    if (
      currentView === 'reservations' ||
      currentView === 'wishlist' ||
      currentView === 'messages' ||
      currentView === 'my-listings' ||
      currentView === 'profile'
    ) {
      setCurrentView('orbit');
    }
  };

  const handleSelectListing = (listing: Listing) => {
    if (currentView === 'orbit' || currentView === 'catalog') {
      setPreviousView(currentView);
    }
    setSpherePopup(null);
    setSelectedListingId(listing.id);
    setCurrentView('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectSphereListing = (listing: Listing, originRect?: OriginRect) => {
    setSpherePopup({
      listing,
      originRect: originRect ?? null,
    });
  };

  const handleOpenCreateModal = (prefill?: Listing | null) => {
    if (!user) {
      void handleSignIn();
      return;
    }
    setCreatePrefill(prefill ?? null);
    setCreateModalOpen(true);
  };

  const handleCreateListing = async (data: {
    title: string;
    description: string;
    price: number;
    category: ListingCategory;
    type: ListingType;
    condition: ListingCondition;
    campusZone: string;
    imageUrl: string;
  }) => {
    if (!user) throw new Error('Please sign in first.');
    if (!isOnline && !IS_EMULATOR_MODE) {
      throw new Error(
        'You appear to be offline. Reconnect before publishing your listing.',
      );
    }
    const sellerName =
      user.displayName?.trim() || user.email?.split('@')[0] || 'UTM Student';

    try {
      const ref = await addDoc(collection(db, 'listings'), {
        ...data,
        sellerId: user.uid,
        sellerName: sellerName.slice(0, 60),
        sellerVerifiedUtm: isUtmStudentEmail(user.email),
        status: 'available',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast('Published to the UTM Orbit Sphere!');
      setSelectedListingId(ref.id);
      setCurrentView('detail');
    } catch (error) {
      if (isNetworkOrUnavailableError(error)) {
        throw new Error(getFriendlyFirebaseError(error));
      }
      handleFirestoreError(error, OperationType.CREATE, 'listings');
    }
  };

  const handleToggleWishlist = async (listing: Listing) => {
    if (!user) {
      await handleSignIn();
      return;
    }
    if (!isOnline && !IS_EMULATOR_MODE) {
      showToast('You are offline. Reconnect to update your Wishlist.');
      return;
    }
    const path = `users/${user.uid}/wishlist/${listing.id}`;
    const ref = doc(db, 'users', user.uid, 'wishlist', listing.id);
    try {
      if (wishlistIds.has(listing.id)) {
        await deleteDoc(ref);
        showToast('Removed from Wishlist.');
      } else {
        await setDoc(ref, {
          listingId: listing.id,
          title: listing.title.slice(0, 100),
          price: listing.price,
          category: listing.category,
          campusZone: listing.campusZone.slice(0, 80),
          imageUrl: listing.imageUrl,
          sellerName: listing.sellerName.slice(0, 60),
          createdAt: serverTimestamp(),
        });
        showToast('Saved to Wishlist!');
      }
    } catch (error) {
      if (isNetworkOrUnavailableError(error)) {
        showToast(getFriendlyFirebaseError(error));
        return;
      }
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleReserveListing = async (listing: Listing) => {
    if (!user) {
      await handleSignIn();
      return;
    }

    const buyerName = (
      user.displayName?.trim() ||
      user.email?.split('@')[0] ||
      'UTM Student'
    ).slice(0, 60);

    // Showcase preview items open an interactive seller chat preview immediately
    if (listing.isShowcase) {
      const previewReservation: Reservation = {
        id: `showcase-${listing.id}`,
        listingId: listing.id,
        listingTitle: listing.title,
        listingImage: listing.imageUrl,
        listingPrice: listing.price,
        buyerId: user.uid,
        buyerName,
        sellerId: listing.sellerId,
        sellerName: listing.sellerName,
        status: 'pending',
        handoverLocation: listing.campusZone,
        handoverDate: '',
        handoverTime: '',
        handoverNote: '',
      };
      setJustReservedChat(true);
      setChatTarget(previewReservation);
      showToast('Preview reserved! Chat box opened.');
      return;
    }

    const listingRef = doc(db, 'listings', listing.id);
    const reservationRef = doc(db, 'reservations', listing.id);

    try {
      let createdReservation: Reservation | null = null;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(listingRef);
        if (!snap.exists()) throw new Error('This listing no longer exists.');
        const current = snap.data() as Omit<Listing, 'id'>;
        if (current.status !== 'available') {
          throw new Error('Sorry, this object has already been reserved.');
        }
        if (current.sellerId === user.uid) {
          throw new Error('You cannot reserve your own listing.');
        }

        tx.update(listingRef, {
          status: 'reserved',
          reservedBy: user.uid,
          updatedAt: serverTimestamp(),
        });

        const payload = {
          listingId: listing.id,
          listingTitle: current.title,
          listingImage: current.imageUrl,
          listingPrice: current.price,
          buyerId: user.uid,
          buyerName,
          sellerId: current.sellerId,
          sellerName: current.sellerName,
          status: 'pending' as const,
          handoverLocation: '',
          handoverDate: '',
          handoverTime: '',
          handoverNote: '',
          handoverLat: null,
          handoverLng: null,
        };

        tx.set(reservationRef, {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        createdReservation = {
          id: listing.id,
          ...payload,
        };
      });

      showToast('Order reserved! Chat with the seller is now open.');
      setCurrentView('reservations');
      if (createdReservation) {
        setJustReservedChat(true);
        setChatTarget(createdReservation);
      }
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        handleFirestoreError(error, OperationType.WRITE, `reservations/${listing.id}`);
      }
      showToast(getFriendlyFirebaseError(error, 'Could not reserve object.'));
    }
  };

  const handleSubmitHandover = async (payload: {
    location: string;
    date: string;
    time: string;
    note: string;
    lat: number;
    lng: number;
  }) => {
    if (!handoverTarget || !user) return;
    if (!isOnline && !IS_EMULATOR_MODE) {
      throw new Error(
        'You appear to be offline. Reconnect to send this handover proposal.',
      );
    }
    const { reservation, mode } = handoverTarget;
    const path = `reservations/${reservation.id}`;
    const ref = doc(db, 'reservations', reservation.id);

    try {
      await updateDoc(ref, {
        handoverLocation: payload.location,
        handoverDate: payload.date,
        handoverTime: payload.time,
        handoverNote: payload.note,
        handoverLat: payload.lat,
        handoverLng: payload.lng,
        status: mode === 'seller' ? 'seller_proposed' : 'buyer_counter_proposed',
        updatedAt: serverTimestamp(),
      });
      showToast(
        mode === 'seller'
          ? 'Handover proposal sent to buyer.'
          : 'Suggested handover changes sent to seller.',
      );
    } catch (error) {
      if (isNetworkOrUnavailableError(error)) {
        throw new Error(getFriendlyFirebaseError(error));
      }
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleConfirmHandover = async (reservation: Reservation) => {
    if (!user) return;
    if (!isOnline && !IS_EMULATOR_MODE) {
      const msg = 'You are offline. Reconnect to confirm handover.';
      showToast(msg);
      throw new Error(msg);
    }
    const path = `reservations/${reservation.id}`;
    try {
      await updateDoc(doc(db, 'reservations', reservation.id), {
        status: 'confirmed',
        updatedAt: serverTimestamp(),
      });
      showToast('Campus handover confirmed!');
    } catch (error) {
      if (isNetworkOrUnavailableError(error)) {
        const msg = getFriendlyFirebaseError(error);
        showToast(msg);
        throw new Error(msg);
      }
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleUpdateListing = async (
    listingId: string,
    updates: {
      title: string;
      description: string;
      price: number;
      category: ListingCategory;
      condition: ListingCondition;
      campusZone: string;
    },
  ) => {
    if (!isOnline && !IS_EMULATOR_MODE) {
      throw new Error(
        'You are offline. Reconnect to save changes to your listing.',
      );
    }
    const path = `listings/${listingId}`;
    try {
      await updateDoc(doc(db, 'listings', listingId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      showToast('Listing updated.');
    } catch (error) {
      if (isNetworkOrUnavailableError(error)) {
        throw new Error(getFriendlyFirebaseError(error));
      }
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleMarkSold = async (listing: Listing) => {
    if (!isOnline && !IS_EMULATOR_MODE) {
      showToast('You are offline. Reconnect to mark listing as sold.');
      return;
    }
    const path = `listings/${listing.id}`;
    try {
      await updateDoc(doc(db, 'listings', listing.id), {
        status: 'sold',
        updatedAt: serverTimestamp(),
      });
      showToast('Listing marked as sold.');
    } catch (error) {
      if (isNetworkOrUnavailableError(error)) {
        showToast(getFriendlyFirebaseError(error));
        return;
      }
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleDeleteListing = async (listing: Listing) => {
    if (!isOnline && !IS_EMULATOR_MODE) {
      showToast('You are offline. Reconnect to delete this listing.');
      return;
    }
    const path = `listings/${listing.id}`;
    try {
      await deleteDoc(doc(db, 'listings', listing.id));
      showToast('Listing deleted.');
    } catch (error) {
      if (isNetworkOrUnavailableError(error)) {
        showToast(getFriendlyFirebaseError(error));
        return;
      }
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F3F3EE] text-[#112419] relative">
      {/* Interactive orbital studio backdrop on non-Home pages linking seamlessly with Home 3D Orbit Sphere */}
      {currentView !== 'orbit' && (
        <AmbientOrbitBackdrop
          onReturnHome={() => {
            setCurrentView('orbit');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}

      <Navbar
        currentView={currentView}
        onNavigate={(view) => {
          setCurrentView(view);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        user={user}
        authLoading={!authReady}
        signingIn={signingIn}
        onSignIn={() => void handleSignIn()}
        onSwitchAccount={() => void handleSignIn()}
        onSignOut={() => void handleSignOut()}
        onOpenCreateModal={() => handleOpenCreateModal(null)}
        reservationCount={reservations.length}
        wishlistCount={wishlistItems.length}
      />

      {/* Non-intrusive offline recovery banner (only renders when offline) */}
      {!isOnline && (
        <div
          role="status"
          className="fixed top-[66px] sm:top-[76px] left-1/2 -translate-x-1/2 z-30 w-[calc(100%-1.5rem)] max-w-xl bg-amber-50/95 backdrop-blur-md border border-amber-300 text-amber-950 rounded-xl px-3.5 py-2 shadow-md flex items-center justify-between gap-3 text-xs"
        >
          <span className="inline-flex items-center gap-2 font-semibold min-w-0">
            <WifiOff className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span className="truncate">
              Offline mode — showing cached campus view. Reconnect to sync.
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              const nowOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
              setIsOnline(nowOnline);
              if (nowOnline) {
                setListingsRetryTick((t) => t + 1);
                setReservationsRetryTick((t) => t + 1);
                setWishlistRetryTick((t) => t + 1);
                showToast('Reconnected — syncing live data.');
              } else {
                showToast('Still offline — check Wi-Fi or mobile data.');
              }
            }}
            className="px-2.5 py-1 rounded-lg bg-amber-900 text-white font-semibold hover:bg-amber-800 inline-flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      <main className={`flex-1 relative z-10 ${currentView !== 'orbit' ? 'pt-20 md:pt-20 pb-20 md:pb-0' : ''}`}>
        {currentView === 'orbit' && (
          <OrbitSphere
            listings={allListings}
            loading={listingsLoading}
            slowLatency={listingsSlow}
            syncError={listingsError}
            onRetrySync={() => setListingsRetryTick((t) => t + 1)}
            isPaused={Boolean(spherePopup)}
            onSelectListing={handleSelectSphereListing}
            onOpenCatalog={() => setCurrentView('catalog')}
            onOpenCreateModal={() => handleOpenCreateModal(null)}
          />
        )}

        {currentView === 'catalog' && (
          <CatalogView
            listings={allListings}
            loading={listingsLoading}
            slowLatency={listingsSlow}
            error={listingsError}
            onRetry={() => setListingsRetryTick((t) => t + 1)}
            wishlistIds={wishlistIds}
            onToggleWishlist={handleToggleWishlist}
            onSelectListing={handleSelectListing}
            onOpenCreateModal={() => handleOpenCreateModal(null)}
          />
        )}

        {currentView === 'detail' && selectedListing && (
          <ObjectDetailView
            listing={selectedListing}
            allListings={allListings}
            user={user}
            isWishlisted={wishlistIds.has(selectedListing.id)}
            onToggleWishlist={handleToggleWishlist}
            onBack={() => setCurrentView(previousView)}
            backLabel={
              previousView === 'orbit'
                ? 'Back to Home'
                : 'Back to Catalog'
            }
            onSelectListing={handleSelectListing}
            onReserveListing={handleReserveListing}
            onNavigateToReservations={() => setCurrentView('reservations')}
            onNavigateToMyListings={() => setCurrentView('my-listings')}
            onSignIn={() => void handleSignIn()}
            onOpenCreateSimilar={(item) => handleOpenCreateModal(item)}
          />
        )}

        {currentView === 'detail' && !selectedListing && (
          <div className="max-w-3xl mx-auto px-5 md:px-10 py-16 text-center">
            {listingsLoading ? (
              <div className="glass-surface border border-[#0A462C]/12 rounded-3xl p-10 inline-flex items-center gap-3 text-sm font-semibold text-[#0A462C]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading campus object details...</span>
              </div>
            ) : (
              <div className="glass-surface border border-[#0A462C]/12 rounded-3xl p-10 space-y-3">
                <p className="text-lg font-bold text-[#112419]">
                  Object unavailable or removed
                </p>
                <p className="text-sm text-[#4A5D50]">
                  This listing may have been removed by the seller or is still syncing.
                </p>
                <button
                  type="button"
                  onClick={() => setCurrentView('catalog')}
                  className="px-5 py-2.5 rounded-xl bg-[#0A462C] text-white text-sm font-semibold hover:bg-[#0E5D3B] cursor-pointer"
                >
                  Back to Catalog
                </button>
              </div>
            )}
          </div>
        )}

        {currentView === 'reservations' && (
          <ReservationsView
            user={user}
            authLoading={!authReady}
            signingIn={signingIn}
            loading={reservationsLoading}
            slowLatency={reservationsSlow}
            error={reservationsError}
            onRetry={() => setReservationsRetryTick((t) => t + 1)}
            reservations={reservations}
            onSignIn={() => void handleSignIn()}
            onOpenHandover={(reservation, mode) =>
              setHandoverTarget({ reservation, mode })
            }
            onConfirmHandover={handleConfirmHandover}
            onOpenChat={(reservation) => {
              setJustReservedChat(false);
              setChatTarget(reservation);
            }}
            onBrowseCatalog={() => setCurrentView('catalog')}
          />
        )}

        {currentView === 'wishlist' && (
          <WishlistView
            user={user}
            authLoading={!authReady}
            signingIn={signingIn}
            loading={wishlistLoading}
            error={wishlistError}
            onRetry={() => setWishlistRetryTick((t) => t + 1)}
            wishlistItems={wishlistItems}
            allListings={allListings}
            onSignIn={() => void handleSignIn()}
            onSelectListing={handleSelectListing}
            onToggleWishlist={handleToggleWishlist}
            onNavigateHome={() => setCurrentView('orbit')}
            onBrowseCatalog={() => setCurrentView('catalog')}
          />
        )}

        {currentView === 'messages' && (
          <MyMessagesView
            user={user}
            authLoading={!authReady}
            signingIn={signingIn}
            reservationsLoading={reservationsLoading}
            reservationsError={reservationsError}
            onRetryReservations={() => setReservationsRetryTick((t) => t + 1)}
            reservations={reservations}
            onSignIn={() => void handleSignIn()}
            onBrowseCatalog={() => setCurrentView('catalog')}
            onOpenHandover={(reservation, mode) =>
              setHandoverTarget({ reservation, mode })
            }
            onNavigateReservations={() => setCurrentView('reservations')}
          />
        )}

        {currentView === 'my-listings' && (
          <MyListingsView
            user={user}
            authLoading={!authReady}
            signingIn={signingIn}
            loading={listingsLoading}
            error={listingsError}
            onRetry={() => setListingsRetryTick((t) => t + 1)}
            listings={liveListings}
            reservations={reservations}
            onSignIn={() => void handleSignIn()}
            onOpenCreateModal={() => handleOpenCreateModal(null)}
            onSeedListings={handleSeedListings}
            onSelectListing={handleSelectListing}
            onOpenChat={(reservation) => {
              setJustReservedChat(false);
              setChatTarget(reservation);
            }}
            onUpdateListing={handleUpdateListing}
            onMarkSold={handleMarkSold}
            onDeleteListing={handleDeleteListing}
          />
        )}

        {currentView === 'profile' && (
          <ProfileView
            user={user}
            authLoading={!authReady}
            signingIn={signingIn}
            onSignIn={() => void handleSignIn()}
            onToast={showToast}
          />
        )}
      </main>

      {currentView !== 'orbit' && (
        <footer className="relative z-10 border-t border-[#0A462C]/10 px-6 md:px-10 pt-6 pb-24 md:pb-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#4A5D50]">
          <div className="flex items-center gap-3">
            <span className="font-bold text-[#0A462C]">CampusTrade UTM</span>
            <span aria-hidden="true">·</span>
            <a
              href="privacy.html"
              className="font-semibold text-[#0A462C] underline underline-offset-2 hover:text-[#0E5D3B]"
            >
              Privacy Policy
            </a>
          </div>
          <span className="text-center sm:text-right">
            Student-to-student exchange at Universiti Teknologi Malaysia, Skudai.
          </span>
        </footer>
      )}

      {/* Sphere Object Pop-Up Modal (expands from & collapses back to the clicked 3D image) */}
      <SphereObjectModal
        listing={spherePopup?.listing ?? null}
        originRect={spherePopup?.originRect ?? null}
        user={user}
        isWishlisted={Boolean(spherePopup && wishlistIds.has(spherePopup.listing.id))}
        onToggleWishlist={handleToggleWishlist}
        onClose={() => setSpherePopup(null)}
        onReserveListing={async (item) => {
          setSpherePopup(null);
          await handleReserveListing(item);
        }}
        onNavigateToReservations={() => {
          setSpherePopup(null);
          setCurrentView('reservations');
        }}
        onNavigateToMyListings={() => {
          setSpherePopup(null);
          setCurrentView('my-listings');
        }}
        onSignIn={() => void handleSignIn()}
        onOpenFullDetail={(item) => handleSelectListing(item)}
        onOpenCreateSimilar={(item) => handleOpenCreateModal(item)}
      />

      {/* Modals */}
      <CreateListingModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        prefill={createPrefill}
        onSubmit={handleCreateListing}
      />

      <UtmHandoverModal
        open={Boolean(handoverTarget)}
        mode={handoverTarget?.mode || 'seller'}
        listingTitle={handoverTarget?.reservation.listingTitle || ''}
        onClose={() => setHandoverTarget(null)}
        onSubmit={handleSubmitHandover}
      />

      <ChatModal
        reservation={chatTarget}
        user={user}
        justReserved={justReservedChat}
        onClose={() => {
          setChatTarget(null);
          setJustReservedChat(false);
        }}
      />

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/92 backdrop-blur-xl border-t border-[#0A462C]/12 px-1 grid grid-cols-5 items-center"
      >
        {(
          [
            { id: 'orbit', label: 'Home', Icon: Compass },
            { id: 'catalog', label: 'Catalog', Icon: Grid },
            { id: 'wishlist', label: 'Saved', Icon: Heart, count: wishlistItems.length },
            { id: 'reservations', label: 'Orders', Icon: Calendar, count: reservations.length },
            { id: 'messages', label: 'Chats', Icon: MessageSquare },
          ] as Array<{
            id: AppView;
            label: string;
            Icon: React.ComponentType<{ className?: string }>;
            count?: number;
          }>
        ).map(({ id, label, Icon, count }) => {
          const active =
            currentView === id || (currentView === 'detail' && id === 'catalog');
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setCurrentView(id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors cursor-pointer ${
                active ? 'text-[#0A462C]' : 'text-[#4A5D50]'
              }`}
            >
              <span className="relative inline-flex items-center justify-center">
                <Icon className="w-[19px] h-[19px]" />
                {typeof count === 'number' && count > 0 && (
                  <span className="ml-0.5 font-mono-tabular text-[10px] font-bold text-[#0A462C]">
                    {count}
                  </span>
                )}
              </span>
              <span
                className={`text-[10px] tracking-tight whitespace-nowrap ${
                  active ? 'font-bold text-[#0A462C]' : 'font-medium'
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Local Firebase Emulator Role Switcher (visible only when connected to local Emulator Suite) */}
      {IS_EMULATOR_MODE && (
        <div className="fixed bottom-20 md:bottom-5 left-3 md:left-5 z-40 glass-surface border border-[#0A462C]/25 rounded-2xl px-3.5 py-2.5 shadow-lg flex flex-wrap items-center gap-2 text-xs max-w-[92vw]">
          <span className="font-bold text-[#0A462C] pr-1">
            {emulatorOnline === false ? 'Emulator Offline:' : 'Emulator:'}
          </span>
          {emulatorOnline === false ? (
            <>
              <span className="text-[#4A5D50]">
                Run <code className="font-mono font-semibold text-[#0A462C]">firebase emulators:start</code>
              </span>
              <button
                type="button"
                onClick={async () => {
                  const ok = await checkEmulatorReachable();
                  setEmulatorOnline(ok);
                  showToast(
                    ok
                      ? 'Firebase Emulator connected! Click Seller or Buyer.'
                      : 'Still cannot reach 127.0.0.1:9099. Run "firebase emulators:start" first.',
                  );
                }}
                className="px-2.5 py-1 rounded-lg bg-[#0A462C] text-white font-semibold hover:bg-[#0D5938] cursor-pointer"
              >
                Retry
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void handleSwitchEmulator('seller')}
                className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                  user?.email === 'seller.utm@graduate.utm.my'
                    ? 'bg-[#0A462C] text-white'
                    : 'bg-white border border-black/10 text-[#112419] hover:bg-[#DCE8D5]/60'
                }`}
              >
                Seller
              </button>
              <button
                type="button"
                onClick={() => void handleSwitchEmulator('buyer')}
                className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                  user?.email === 'buyer.utm@graduate.utm.my'
                    ? 'bg-[#0A462C] text-white'
                    : 'bg-white border border-black/10 text-[#112419] hover:bg-[#DCE8D5]/60'
                }`}
              >
                Buyer
              </button>
              {user && liveListings.length === 0 && (
                <button
                  type="button"
                  onClick={() => void handleSeedListings()}
                  className="px-2.5 py-1 rounded-lg bg-[#DCE8D5] text-[#0A462C] font-semibold hover:bg-[#c8dec0] cursor-pointer"
                >
                  Seed Items
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?emulator=false`;
            }}
            className="px-2 py-1 rounded-lg border border-black/10 text-[#4A5D50] hover:text-[#112419] hover:bg-white cursor-pointer"
          >
            Exit
          </button>
        </div>
      )}

      {/* Toast Feedback */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 md:bottom-6 right-3 md:right-6 z-50 bg-[#0A462C] text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-lg max-w-[calc(100vw-1.5rem)] sm:max-w-sm"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MarketplaceContent />
    </ErrorBoundary>
  );
}
