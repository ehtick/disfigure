
// disfigure



import { Euler, EventDispatcher, Quaternion, Vector3 } from 'three';
import { everybody } from './world.js';
import { EQ, EQ_POS } from './tsl.js';
import { JOINTS } from './assets.js';
import { Pool } from './pool.js';



// degrees-radian conversion
var toDeg = x => x * 180 / Math.PI,
	toRad = x => x / 180 * Math.PI;



// global unique identifier for bodies
var uid = 0;



class EulerDegrees extends Euler {

	constructor( signX, signY, signZ ) {

		super();
		this.signX = signX;
		this.signY = signY;
		this.signZ = signZ;
		this.quaternion = new Quaternion();
		this.needsUpdate = true;

	}

	set( x, y, z ) {

		this.x = x;
		this.y = y;
		this.z = z;

	}

	set x( n ) {

		super.x = toRad( this.signX*n );
		this.needsUpdate = true;

	}

	set y( n ) {

		super.y = toRad( this.signY*n );
		this.needsUpdate = true;

	}

	set z( n ) {

		super.z = toRad( this.signZ*n );
		this.needsUpdate = true;

	}

	get x( ) {

		return toDeg( this.signX*super.x );

	}

	get y( ) {

		return toDeg( this.signY*super.y );

	}

	get z( ) {

		return toDeg( this.signZ*super.z );

	}

	get q( ) {

		if ( this.needsUpdate ) {

			this.quaternion.setFromEuler( this );
			this.needsUpdate = false;

		}

		return this.quaternion;

	}

}


class Body extends EventDispatcher {

	constructor( pool ) {

		super();

		this.pool = pool;
		this.id = pool.getBody();
		this.uid = uid++;

		this.eulers = [];

		for ( var i=0; i<EQ; i++ ) {

			this.eulers.push( new EulerDegrees( ...JOINTS[ i ].signs ) );

			this[ JOINTS[ i ].name ] = this.eulers[ i ];

		}

		everybody.push( this );

	}

	setPosition( x, y, z ) {

		var array = this.pool.instanceMatrix.array,
			index = this.id * 16+12;

		array[ index++ ] = x;
		array[ index++ ] = y;
		array[ index++ ] = z;

		this.pool.instanceMatrix.needsUpdate = true;

		//this.pool.setXYZ( this.id, EQ_POS, x, y, z );
		//this.pool.quatTexture.needsUpdate = true;

	}

	update( ) {

		for ( var i=0; i<EQ-2; i++ )
			this.pool.setQ( this.id, i, this.eulers[ i ].q );
		this.pool.quatTexture.needsUpdate = true;

	}

} // Body



class Man extends Body {

	static pool = null;
	static count = 10; // max number of men
	static lowpoly = 0; // lowpoly-ness, 0=original, 1.0 remove 75%
	static vertexStage = false; // true for faster but uglier normals

	constructor( ) {

		if ( Man.pool == null ) {

			Man.pool = new Pool( 'man', Man.count, Man.lowpoly, Man.vertexStage );

		}

		super( Man.pool );

		this.material = Man.pool.material; // expose to outside

		this.l_arm.z = this.r_arm.z = -75;
		this.l_elbow.y = this.r_elbow.y = 20;
		this.l_leg.z = this.r_leg.z = 10;
		this.l_ankle.z = this.r_ankle.z = -10;
		this.l_ankle.x = this.r_ankle.x = 3;

		this.setPosition( 0, -0.012, 0 );

	}

} // Man



class Woman extends Body {

	static pool = null;
	static count = 10; // max number of women
	static lowpoly = 0; // lowpoly-ness, 0=original, 1.0 remove 75%
	static vertexStage = false; // true for faster but uglier normals

	constructor( ) {

		if ( Woman.pool == null ) {

			Woman.pool = new Pool( 'woman', Woman.count, Woman.lowpoly, Woman.vertexStage );

		}

		super( Woman.pool );

		this.material = Woman.pool.material; // expose to outside

		this.l_arm.z = this.r_arm.z = -90;
		this.l_elbow.y = this.r_elbow.y = 0;
		this.l_leg.z = this.r_leg.z = -3;
		this.l_ankle.z = this.r_ankle.z = 3;
		this.l_ankle.x = this.r_ankle.x = 3;

	}

} // Woman



class Child extends Body {

	static pool = null;
	static count = 10; // max number of children
	static lowpoly = 0; // lowpoly-ness, 0=original, 1.0 remove 75%
	static vertexStage = false; // true for faster but uglier normals

	constructor( ) {

		if ( Child.pool == null ) {

			Child.pool = new Pool( 'child', Child.count, Child.lowpoly, Child.vertexStage );

		}

		super( Child.pool );

		this.material = Child.pool.material; // expose to outside

		this.l_arm.x = this.r_arm.x = -10;
		this.l_arm.z = this.r_arm.z = -80;
		this.l_ankle.bend = this.r_ankle.bend = 3;

	}

} // Child



export { Man, Woman, Child };
