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
  auth,
  checkEmulatorReachable,
  db,
  googleProvider,
  handleFirestoreError,
  IS_EMULATOR_MODE,
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
  const [emulatorOnline, setEmulatorOnline] = useState<boolean | null>(null);

  const [currentView, setCurrentView] = useState<AppView>('orbit');
  const [previousView, setPreviousView] = useState<'orbit' | 'catalog'>('orbit');
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [spherePopup, setSpherePopup] = useState<{
    listing: Listing;
    originRect: OriginRect | null;
  } | null>(null);

  const [liveListings, setLiveListings] = useState<Listing[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);

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

  // Public listings listener
  useEffect(() => {
    const q = query(collection(db, 'listings'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Listing, 'id'>),
        }));
        setLiveListings(docs);
      },
      (error) => {
        const code = (error as { code?: string })?.code || '';
        const msg = error instanceof Error ? error.message : String(error);
        if (
          IS_EMULATOR_MODE &&
          (code === 'unavailable' ||
            msg.includes('offline') ||
            msg.includes('Failed to fetch'))
        ) {
          setEmulatorOnline(false);
          return;
        }
        handleFirestoreError(error, OperationType.LIST, 'listings');
      },
    );
    return () => unsub();
  }, []);

  // Authenticated user's reservations listener (buyer + seller merged)
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) {
      setReservations([]);
      return;
    }

    let buyerDocs: Reservation[] = [];
    let sellerDocs: Reservation[] = [];

    const mergeAndSet = () => {
      const map = new Map<string, Reservation>();
      [...buyerDocs, ...sellerDocs].forEach((r) => map.set(r.id, r));
      setReservations(Array.from(map.values()));
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
      const code = (error as { code?: string })?.code || '';
      if (IS_EMULATOR_MODE && code === 'unavailable') {
        setEmulatorOnline(false);
        return;
      }
      handleFirestoreError(error, OperationType.LIST, 'reservations');
    };

    const unsubBuyer = onSnapshot(
      buyerQ,
      (snap) => {
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
        sellerDocs = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Reservation, 'id'>),
        }));
        mergeAndSet();
      },
      handleSubError,
    );

    return () => {
      unsubBuyer();
      unsubSeller();
    };
  }, [authReady, user, authRevision]);

  // Authenticated user's wishlist listener
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) {
      setWishlistItems([]);
      return;
    }

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
      },
      (error) => {
        if (!auth.currentUser || auth.currentUser.uid !== user.uid) return;
        const code = (error as { code?: string })?.code || '';
        if (IS_EMULATOR_MODE && code === 'unavailable') {
          setEmulatorOnline(false);
          return;
        }
        handleFirestoreError(error, OperationType.LIST, path);
      },
    );

    return () => unsub();
  }, [authReady, user, authRevision]);

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
    if (IS_EMULATOR_MODE) {
      const nextRole =
        user?.email === 'buyer.utm@graduate.utm.my' ? 'seller' : 'buyer';
      await handleSwitchEmulator(nextRole);
      return;
    }
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
      const msg = err instanceof Error ? err.message : 'Sign-in cancelled.';
      if (!msg.includes('popup-closed-by-user')) {
        showToast(msg);
      }
    }
  };

  const handleSeedListings = async () => {
    if (!user) {
      await handleSignIn();
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
      handleFirestoreError(error, OperationType.CREATE, 'listings');
    }
  };

  const handleToggleWishlist = async (listing: Listing) => {
    if (!user) {
      await handleSignIn();
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
      if (error instanceof Error && error.message.includes('Missing or insufficient permissions')) {
        handleFirestoreError(error, OperationType.WRITE, `reservations/${listing.id}`);
      }
      showToast(error instanceof Error ? error.message : 'Could not reserve object.');
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
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleConfirmHandover = async (reservation: Reservation) => {
    if (!user) return;
    const path = `reservations/${reservation.id}`;
    try {
      await updateDoc(doc(db, 'reservations', reservation.id), {
        status: 'confirmed',
        updatedAt: serverTimestamp(),
      });
      showToast('Campus handover confirmed!');
    } catch (error) {
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
    const path = `listings/${listingId}`;
    try {
      await updateDoc(doc(db, 'listings', listingId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      showToast('Listing updated.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleMarkSold = async (listing: Listing) => {
    const path = `listings/${listing.id}`;
    try {
      await updateDoc(doc(db, 'listings', listing.id), {
        status: 'sold',
        updatedAt: serverTimestamp(),
      });
      showToast('Listing marked as sold.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleDeleteListing = async (listing: Listing) => {
    const path = `listings/${listing.id}`;
    try {
      await deleteDoc(doc(db, 'listings', listing.id));
      showToast('Listing deleted.');
    } catch (error) {
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
        onSignIn={() => void handleSignIn()}
        onSwitchAccount={() => void handleSignIn()}
        onSignOut={() => void handleSignOut()}
        onOpenCreateModal={() => handleOpenCreateModal(null)}
        reservationCount={reservations.length}
        wishlistCount={wishlistItems.length}
      />

      {/* Mobile Secondary View Switcher (floating semi-transparent strip) */}
      <div className="md:hidden fixed top-20 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center gap-3.5 px-4 py-1.5 rounded-xl bg-white/65 backdrop-blur-xl border border-white/65 shadow-sm max-w-[94vw] overflow-x-auto">
        {(['orbit', 'catalog', 'wishlist', 'reservations', 'messages'] as AppView[]).map(
          (v) => (
            <button
              key={v}
              type="button"
              onClick={() => setCurrentView(v)}
              className={`text-xs font-semibold capitalize whitespace-nowrap py-0.5 cursor-pointer ${
                currentView === v ? 'text-[#0A462C] underline underline-offset-4' : 'text-[#4A5D50]'
              }`}
            >
              {v === 'orbit' ? 'Home' : v === 'messages' ? 'Messages' : v}
            </button>
          ),
        )}
      </div>

      <main className={`flex-1 relative z-10 ${currentView !== 'orbit' ? 'pt-28 md:pt-20' : ''}`}>
        {currentView === 'orbit' && (
          <OrbitSphere
            listings={allListings}
            isPaused={Boolean(spherePopup)}
            onSelectListing={handleSelectSphereListing}
            onOpenCatalog={() => setCurrentView('catalog')}
            onOpenCreateModal={() => handleOpenCreateModal(null)}
          />
        )}

        {currentView === 'catalog' && (
          <CatalogView
            listings={allListings}
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

        {currentView === 'reservations' && (
          <ReservationsView
            user={user}
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
            onSignIn={() => void handleSignIn()}
            onToast={showToast}
          />
        )}
      </main>

      {currentView !== 'orbit' && (
        <footer className="relative z-10 border-t border-[#0A462C]/10 px-6 md:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#4A5D50]">
          <span className="font-bold text-[#0A462C]">CampusTrade UTM</span>
          <span>Student-to-student exchange at Universiti Teknologi Malaysia, Skudai.</span>
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

      {/* Local Firebase Emulator Role Switcher (visible only when connected to local Emulator Suite) */}
      {IS_EMULATOR_MODE && (
        <div className="fixed bottom-5 left-5 z-40 glass-surface border border-[#0A462C]/25 rounded-2xl px-3.5 py-2.5 shadow-lg flex flex-wrap items-center gap-2 text-xs max-w-[92vw]">
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
          className="fixed bottom-6 right-6 z-50 bg-[#0A462C] text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-lg max-w-sm"
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
