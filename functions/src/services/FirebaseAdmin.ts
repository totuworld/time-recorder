import * as functions from 'firebase-functions';
import * as admin from "firebase-admin";


class FireabaseAdminType {
  private init: boolean = false;
  constructor() {
    if (this.init === false) {
      this.bootstrap();
    }
  }

  bootstrap() {
    const config = functions.config().fbconf;

    admin.initializeApp({
      databaseURL: config.databaseurl,
      credential: admin.credential.cert(config.credential)});
    this.init = true;
  }

  get isInit() {
    return this.init;
  }

  /** 리얼타임 db */
  get Database() {
    if (this.init === false) {
      this.bootstrap();
    }
    return admin.database();
  }

  /** firestore */
  get Firestore() {
    if (this.init === false) {
      this.bootstrap();
    }
    return admin.firestore();
  }
}

export const FireabaseAdmin = new FireabaseAdminType();
